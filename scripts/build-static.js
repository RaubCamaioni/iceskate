// Builds the static snapshot used when the site is hosted without the Node server (GitHub Pages).
// Writes public/data/schedule.json in the same shape the /api/events endpoint returns, covering
// today .. today+HORIZON_DAYS. The frontend falls back to this file when api/events is missing.
//
// Run:  node scripts/build-static.js        (TZ should be America/New_York; the workflow sets it)
// Exits non-zero when any rink fails so a failed sync keeps the previous deploy live.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAdapters, publicRinkInfo, todayISO, addDaysISO, sortEvents } from '../server/server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'public', 'data', 'schedule.json');
const HORIZON_DAYS = Number(process.env.CACHE_HORIZON_DAYS) || 35;

// Pure apart from the adapter calls: fetch every rink for [from, to] and assemble the response body.
export async function buildSnapshot(adapters, { from, to }) {
  const results = await Promise.allSettled(adapters.map((a) => a.fetchEvents({ from, to })));
  const events = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') events.push(...r.value);
    else errors.push({ rink: adapters[i].slug, message: String(r.reason?.message ?? r.reason), stale: false });
  });
  const now = new Date().toISOString();
  return { generatedAt: now, fetchedAt: now, source: 'static', from, to, rinks: adapters.map(publicRinkInfo), events: sortEvents(events), errors };
}

async function main() {
  const adapters = await loadAdapters();
  const from = todayISO();
  const to = addDaysISO(from, HORIZON_DAYS);
  const started = Date.now();
  const snap = await buildSnapshot(adapters, { from, to });
  for (const e of snap.errors) console.error(`[build] ${e.rink} failed: ${e.message}`);
  if (snap.errors.length) {
    console.error(`[build] ${snap.errors.length}/${adapters.length} rinks failed; not writing a partial snapshot`);
    process.exit(1);
  }
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(snap));
  console.log(`[build] wrote ${path.relative(ROOT, OUT_FILE)}: ${snap.events.length} events from ${adapters.length} rinks, ${from}..${to}, ${Date.now() - started} ms`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
