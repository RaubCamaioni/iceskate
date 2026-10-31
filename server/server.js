// Dependency-free HTTP server.
//  - serves ./public as static files
//  - GET /api/rinks            -> list of rink adapters
//  - GET /api/events?from&to   -> merged, normalised events from every rink
//
// Rink adapters are discovered from rinks/*/adapter.js (folders starting with "_" are skipped).
//
// Caching model: the server keeps one rolling window of events (today .. today+HORIZON_DAYS)
// for every rink in memory, refreshes it in the background every REFRESH_MS, and writes a
// snapshot to .cache/ so a restart serves instantly. Requests are answered from memory and
// never wait on a rink; a failed refresh keeps the previous data and reports the error.
// Ranges outside the window fall back to an on-demand fetch with a short cache.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const RINKS_DIR = path.join(ROOT, 'rinks');
const CACHE_DIR = path.join(ROOT, '.cache');
const SNAPSHOT_FILE = path.join(CACHE_DIR, 'events-snapshot.json');

const PORT = Number(process.env.PORT) || 3000;
const REFRESH_MS = Number(process.env.CACHE_REFRESH_MS) || 60 * 60 * 1000; // hourly
const HORIZON_DAYS = Number(process.env.CACHE_HORIZON_DAYS) || 35; // days ahead kept warm
const PAST_DAYS = Number(process.env.CACHE_PAST_DAYS ?? 7); // days back kept warm (covers the current week view)
const ONDEMAND_TTL_MS = Number(process.env.CACHE_TTL_MS) || 10 * 60 * 1000; // out-of-window ranges
const MAX_RANGE_DAYS = 60;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---------------------------------------------------------------- adapters
export async function loadAdapters() {
  const entries = await fs.readdir(RINKS_DIR, { withFileTypes: true });
  const adapters = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('_')) continue;
    const file = path.join(RINKS_DIR, e.name, 'adapter.js');
    try {
      await fs.access(file);
    } catch {
      continue;
    }
    const mod = await import(pathToFileURL(file).href);
    const adapter = mod.default ?? mod;
    if (typeof adapter.fetchEvents !== 'function') {
      console.warn(`[rinks] ${e.name}/adapter.js has no fetchEvents(); skipped`);
      continue;
    }
    adapters.push({ slug: adapter.slug ?? e.name, ...adapter });
  }
  adapters.sort((a, b) => a.name.localeCompare(b.name));
  return adapters;
}

export function publicRinkInfo(a) {
  return { slug: a.slug, name: a.name, shortName: a.shortName ?? a.name, address: a.address ?? null, phone: a.phone ?? null, onlinePay: Boolean(a.onlinePay), website: a.website ?? null, registerUrl: a.registerUrl ?? null, color: a.color ?? null, sheets: a.sheets ?? [] };
}

// ---------------------------------------------------------------- dates
const pad = (n) => String(n).padStart(2, '0');
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}
export function daysBetween(fromISO, toISO) {
  const [y1, m1, d1] = fromISO.split('-').map(Number);
  const [y2, m2, d2] = toISO.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function sortEvents(events) {
  return events.sort((a, b) => a.start.localeCompare(b.start) || a.rink.localeCompare(b.rink) || a.sheet.localeCompare(b.sheet));
}

// Pure: pick events whose start date falls within [from, to] inclusive.
export function selectRange(events, from, to) {
  const lo = `${from}T00:00:00`;
  const hi = `${to}T23:59:59`;
  return events.filter((e) => e.start >= lo && e.start <= hi);
}

// ---------------------------------------------------------------- event store
export class EventStore {
  constructor(adapters, { horizonDays = HORIZON_DAYS, pastDays = PAST_DAYS, snapshotFile = SNAPSHOT_FILE, log = console } = {}) {
    this.adapters = adapters;
    this.horizonDays = horizonDays;
    this.pastDays = pastDays;
    this.snapshotFile = snapshotFile;
    this.log = log;
    this.window = { from: null, to: null };
    this.rinks = new Map(); // slug -> { events, fetchedAt, error }
    this.refreshing = null;
    this.onDemand = new Map(); // key -> { expires, promise }
  }

  get status() {
    const rinks = {};
    for (const a of this.adapters) {
      const r = this.rinks.get(a.slug);
      rinks[a.slug] = { fetchedAt: r?.fetchedAt ?? null, events: r?.events?.length ?? 0, error: r?.error ?? null };
    }
    return { window: this.window, refreshing: Boolean(this.refreshing), rinks };
  }

  covers(from, to) {
    return this.window.from && from >= this.window.from && to <= this.window.to;
  }

  async loadSnapshot() {
    try {
      const snap = JSON.parse(await fs.readFile(this.snapshotFile, 'utf8'));
      this.window = snap.window;
      for (const [slug, r] of Object.entries(snap.rinks)) this.rinks.set(slug, { events: r.events, fetchedAt: r.fetchedAt, error: null });
      const n = [...this.rinks.values()].reduce((s, r) => s + r.events.length, 0);
      this.log.log(`[cache] loaded snapshot: ${n} events, window ${snap.window.from}..${snap.window.to}`);
      return true;
    } catch {
      return false;
    }
  }

  async saveSnapshot() {
    const rinks = {};
    for (const [slug, r] of this.rinks) rinks[slug] = { events: r.events, fetchedAt: r.fetchedAt };
    try {
      await fs.mkdir(path.dirname(this.snapshotFile), { recursive: true });
      const tmp = `${this.snapshotFile}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ window: this.window, rinks }));
      await fs.rename(tmp, this.snapshotFile);
    } catch (err) {
      this.log.warn(`[cache] could not write snapshot: ${err.message}`);
    }
  }

  // Refresh every rink for the rolling window. Concurrent calls share one run.
  refresh() {
    if (this.refreshing) return this.refreshing;
    const today = todayISO();
    const from = addDaysISO(today, -this.pastDays);
    const to = addDaysISO(today, this.horizonDays);
    const started = Date.now();
    this.refreshing = (async () => {
      const results = await Promise.allSettled(this.adapters.map((a) => a.fetchEvents({ from, to }).then((events) => ({ a, events }))));
      let ok = 0;
      results.forEach((r, i) => {
        const a = this.adapters[i];
        if (r.status === 'fulfilled') {
          this.rinks.set(a.slug, { events: sortEvents(r.value.events), fetchedAt: new Date().toISOString(), error: null });
          ok += 1;
        } else {
          const prev = this.rinks.get(a.slug) ?? { events: [], fetchedAt: null };
          this.rinks.set(a.slug, { ...prev, error: String(r.reason?.message ?? r.reason) });
          this.log.error(`[cache] ${a.slug} refresh failed, keeping previous data:`, r.reason?.message ?? r.reason);
        }
      });
      if (ok > 0) this.window = { from, to };
      const n = [...this.rinks.values()].reduce((s, r) => s + r.events.length, 0);
      this.log.log(`[cache] refreshed ${ok}/${this.adapters.length} rinks, ${n} events, window ${from}..${to}, ${Date.now() - started} ms`);
      await this.saveSnapshot();
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  start(intervalMs = REFRESH_MS) {
    this.timer = setInterval(() => this.refresh(), intervalMs);
    if (this.timer.unref) this.timer.unref();
    return this.refresh();
  }

  stop() {
    clearInterval(this.timer);
  }

  // Answer a range. Inside the warm window: instant, from memory.
  // Outside it: on-demand fetch with a short cache (never blocks other callers' warm reads).
  async getEvents(from, to) {
    if (this.covers(from, to)) {
      const events = [];
      const errors = [];
      let fetchedAt = null;
      for (const a of this.adapters) {
        const r = this.rinks.get(a.slug);
        if (!r) continue;
        events.push(...selectRange(r.events, from, to));
        if (r.error) errors.push({ rink: a.slug, message: r.error, stale: Boolean(r.fetchedAt) });
        if (r.fetchedAt && (!fetchedAt || r.fetchedAt < fetchedAt)) fetchedAt = r.fetchedAt;
      }
      return { events: sortEvents(events), errors, fetchedAt, source: 'cache' };
    }
    const key = `${from}|${to}`;
    const hit = this.onDemand.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;
    const promise = (async () => {
      const results = await Promise.allSettled(this.adapters.map((a) => a.fetchEvents({ from, to })));
      const events = [];
      const errors = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') events.push(...r.value);
        else errors.push({ rink: this.adapters[i].slug, message: String(r.reason?.message ?? r.reason), stale: false });
      });
      return { events: sortEvents(events), errors, fetchedAt: new Date().toISOString(), source: 'live' };
    })();
    this.onDemand.set(key, { expires: Date.now() + ONDEMAND_TTL_MS, promise });
    promise.catch(() => this.onDemand.delete(key));
    return promise;
  }
}

// ---------------------------------------------------------------- http
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}

export async function createServer() {
  const adapters = await loadAdapters();
  console.log(`[rinks] loaded: ${adapters.map((a) => a.slug).join(', ') || '(none)'}`);
  const store = new EventStore(adapters);
  const hadSnapshot = await store.loadSnapshot();
  // Warm the cache: block startup on the first fetch only when there is no snapshot to serve.
  const warm = store.start();
  if (!hadSnapshot) await warm;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/api/rinks') return json(res, 200, adapters.map(publicRinkInfo));
      if (url.pathname === '/api/status') return json(res, 200, { now: new Date().toISOString(), refreshMs: REFRESH_MS, ...store.status });
      if (url.pathname === '/api/events') {
        const from = url.searchParams.get('from') || todayISO();
        const to = url.searchParams.get('to') || addDaysISO(from, 13);
        if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return json(res, 400, { error: 'from/to must be YYYY-MM-DD' });
        const span = daysBetween(from, to);
        if (span < 0 || span > MAX_RANGE_DAYS) return json(res, 400, { error: `range must be 0..${MAX_RANGE_DAYS} days` });
        const { events, errors, fetchedAt, source } = await store.getEvents(from, to);
        return json(res, 200, { generatedAt: new Date().toISOString(), fetchedAt, source, refreshMs: REFRESH_MS, from, to, rinks: adapters.map(publicRinkInfo), events, errors });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
      }
      return serveStatic(req, res);
    } catch (err) {
      console.error(err);
      return json(res, 500, { error: 'internal error' });
    }
  });
  server.store = store;
  server.on('close', () => store.stop());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createServer();
  server.listen(PORT, () => console.log(`NoVA ice schedules: http://localhost:${PORT}  (refresh every ${Math.round(REFRESH_MS / 60000)} min, window ${HORIZON_DAYS} days)`));
}
