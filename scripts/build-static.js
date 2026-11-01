// Builds the static snapshot used when the site is hosted without the Node server (GitHub Pages).
// Writes public/data/schedule.json in the same shape the /api/events endpoint returns, covering
// today .. today+HORIZON_DAYS. The frontend falls back to this file when api/events is missing.
//
// Run:  node scripts/build-static.js        (TZ should be America/New_York; the workflow sets it)
//
// A rink whose fetch fails keeps its events from the previously published snapshot
// (PREVIOUS_SNAPSHOT_URL, default: the live site) and is reported as stale, so one flaky
// rink never blocks the daily deploy. The build fails only when every rink fails.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAdapters, publicRinkInfo, todayISO, addDaysISO, sortEvents, selectRange } from '../server/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'public', 'data', 'schedule.json');
const HORIZON_DAYS = Number(process.env.CACHE_HORIZON_DAYS) || 35;
const PREVIOUS_URL = process.env.PREVIOUS_SNAPSHOT_URL ?? 'https://raubcamaioni.github.io/iceskate/data/schedule.json';

// Fetch every rink for [from, to] and assemble the response body. `previous` (an earlier snapshot)
// supplies the events of any rink that fails; those rinks are listed in `errors` with stale: true.
export async function buildSnapshot(adapters, { from, to, previous = null }) {
  const results = await Promise.allSettled(adapters.map((a) => a.fetchEvents({ from, to })));
  const events = [];
  const errors = [];
  let fetchedAt = new Date().toISOString();
  results.forEach((r, i) => {
    const slug = adapters[i].slug;
    if (r.status === 'fulfilled') { events.push(...r.value); return; }
    const message = String(r.reason?.message ?? r.reason);
    const old = previous?.events?.filter((e) => e.rink === slug) ?? [];
    if (old.length) {
      events.push(...selectRange(old, from, to));
      if (previous.fetchedAt && previous.fetchedAt < fetchedAt) fetchedAt = previous.fetchedAt;
    }
    errors.push({ rink: slug, message, stale: old.length > 0 });
  });
  return { generatedAt: new Date().toISOString(), fetchedAt, source: 'static', from, to, rinks: adapters.map(publicRinkInfo), events: sortEvents(events), errors };
}

async function loadPrevious() {
  try {
    const res = await fetch(PREVIOUS_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const snap = await res.json();
    console.log(`[build] previous snapshot from ${PREVIOUS_URL}: ${snap.events?.length ?? 0} events, generated ${snap.generatedAt}`);
    return snap;
  } catch (err) {
    console.warn(`[build] no previous snapshot (${err.message})`);
    return null;
  }
}

// GitHub Pages caches files for ten minutes, so a visitor could get a new index.html with an old
// app.js. Stamp the script and stylesheet URLs with the commit (or the time) on every build.
async function versionAssets() {
  const file = path.join(ROOT, 'public', 'index.html');
  const ver = (process.env.GITHUB_SHA ?? String(Date.now())).slice(0, 10);
  const html = await fs.readFile(file, 'utf8');
  const out = html.replace(/(href|src)="(style\.css|app\.js)(\?v=[^"]*)?"/g, `$1="$2?v=${ver}"`);
  if (out !== html) await fs.writeFile(file, out);
  // app.js imports sibling modules; stamp those too so GitHub Pages' cache cannot pair old and new files.
  const appFile = path.join(ROOT, 'public', 'app.js');
  const app = await fs.readFile(appFile, 'utf8');
  const appOut = app.replace(/from '\.\/([a-z-]+\.js)(\?v=[^']*)?'/g, `from './$1?v=${ver}'`);
  if (appOut !== app) await fs.writeFile(appFile, appOut);
  console.log(`[build] assets versioned ?v=${ver}`);
}

async function main() {
  const adapters = await loadAdapters();
  const from = todayISO();
  const to = addDaysISO(from, HORIZON_DAYS);
  const started = Date.now();
  const previous = await loadPrevious();
  const snap = await buildSnapshot(adapters, { from, to, previous });
  for (const e of snap.errors) console.error(`[build] ${e.rink} failed: ${e.message}${e.stale ? ' (reusing previous data)' : ' (no previous data; rink omitted)'}`);
  if (snap.errors.length === adapters.length) {
    console.error('[build] every rink failed; not writing a snapshot');
    process.exit(1);
  }
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(snap));
  await versionAssets();
  console.log(`[build] wrote ${path.relative(ROOT, OUT_FILE)}: ${snap.events.length} events from ${adapters.length - snap.errors.length}/${adapters.length} rinks, ${from}..${to}, ${Date.now() - started} ms`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
