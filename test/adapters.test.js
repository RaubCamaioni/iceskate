import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ashburn from '../rinks/ashburn-ice-house/adapter.js';
import * as ion from '../rinks/ion-leesburg/adapter.js';
import { loadAdapters, addDaysISO, daysBetween, selectRange, EventStore } from '../server/server.js';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (rel) => JSON.parse(await fs.readFile(path.join(ROOT, rel), 'utf8'));

const CATEGORIES = new Set(['public_skate', 'freestyle', 'stick_and_puck', 'pickup_hockey', 'learn_to_skate', 'hockey', 'figure_skating', 'other']);
const ISO_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

function assertNormalized(events, rinkSlug) {
  assert.ok(events.length > 0, 'produces events');
  for (const e of events) {
    assert.equal(e.rink, rinkSlug);
    assert.ok(e.sheet, 'sheet set');
    assert.match(e.start, ISO_LOCAL);
    assert.match(e.end, ISO_LOCAL);
    assert.ok(e.start < e.end || e.end.endsWith('T23:59:00'), `start before end: ${e.start} ${e.end}`);
    assert.equal(typeof e.title, 'string', 'title is a string (may be empty for drop-ins)');
    assert.ok(CATEGORIES.has(e.category), `category ${e.category}`);
    assert.equal(e.create_u, undefined, 'no staff fields leak');
  }
}

test('ashburn: normalises a day of DaySmart events', async () => {
  const page = await readJson('rinks/ashburn-ice-house/samples/events-2026-11-01.json');
  const events = ashburn.normalize(page);
  assertNormalized(events, 'ashburn-ice-house');
  assert.ok(events.every((e) => e.title !== 'Block'), 'setup blocks hidden');
  assert.ok(events.some((e) => e.sheet === 'East Rink') && events.some((e) => e.sheet === 'West Rink'));
  const playground = events.find((e) => /Playground on Ice/.test(e.title));
  assert.ok(playground, 'finds Playground on Ice');
  assert.equal(playground.category, 'public_skate');
  assert.equal(playground.capacity, 150);
  assert.ok(playground.registerUrl);
  const pub = events.find((e) => /^Public/.test(e.title));
  assert.ok(pub, 'finds a public skate');
  assert.equal(pub.category, 'public_skate');
  assert.equal(pub.capacity, 300);
  const freestyle = events.find((e) => /Freestyle/.test(e.title));
  assert.equal(freestyle.category, 'freestyle');
  const game = events.find((e) => / vs /.test(e.title));
  assert.equal(game.category, 'hockey');
  assert.equal(game.registerUrl, null);
});

test('ashburn: tolerates non-string description fields', () => {
  const mk = (best_description) => ({
    data: [{ id: '9', attributes: { publish: true, start: '2026-11-01T06:00:00', end: '2026-11-01T07:00:00', resource_id: 2, register_capacity: 300, desc: '', best_description } }],
    included: [{ type: 'event-summaries', id: '9', attributes: { name: 'Public-Weekend Afternoon', event_type: 'Camp', color: '#000' } }, { type: 'resources', id: '2', attributes: { name: 'West Rink ' } }],
  });
  for (const weird of [null, undefined, 42, { html: 'x' }, ['a']]) {
    const [e] = ashburn.normalize(mk(weird));
    assert.equal(e.category, 'public_skate');
    assert.equal(typeof e.subtitle, 'string');
  }
});

test('ashburn: hides unpublished events', () => {
  const page = { data: [{ id: '1', attributes: { publish: false, start: '2026-11-01T06:00:00', end: '2026-11-01T07:00:00', resource_id: 1, register_capacity: 0 } }], included: [] };
  assert.equal(ashburn.normalize(page).length, 0);
});

test('ashburn: classify', () => {
  assert.equal(ashburn.classify('Public-Weekday Morning', 'Camp'), 'public_skate');
  assert.equal(ashburn.classify("Public- Friday Rockin' Skate", 'Camp'), 'public_skate');
  assert.equal(ashburn.classify('Freestyle- Weekdays before 12pm', 'Camp'), 'freestyle');
  assert.equal(ashburn.classify('Stick n Shoot - Mornings', 'Camp'), 'stick_and_puck');
  assert.equal(ashburn.classify('Adult Pickup- Weekday Afternoon', 'Camp'), 'pickup_hockey');
  assert.equal(ashburn.classify('Snowplow 1- Saturday 11:40am', 'Class'), 'learn_to_skate');
  assert.equal(ashburn.classify('Fast Track', 'Camp'), 'learn_to_skate');
  assert.equal(ashburn.classify('EHL 10U Black vs EHL 10U Gold', 'Game'), 'hockey');
  assert.equal(ashburn.classify('CTOI 2026-27 Fall/Winter Ice', 'Theater on Ice'), 'figure_skating');
  assert.equal(ashburn.classify('Pre-Freeskate through Freeskate 6', 'Camp'), 'learn_to_skate');
  assert.equal(ashburn.classify('Ice Show- Freeskate 1-3 (Sunday 12:20pm)', 'Camp'), 'figure_skating');
  assert.equal(ashburn.classify('Freestyle- Weekends', 'Camp'), 'freestyle');
});

test('ashburn: truncate cuts at a word boundary', () => {
  const long = 'Playground on ice is a special type of public skating session for 2-8 year olds to develop a love for skating! This is a great way to introduce young skaters.';
  const t = ashburn.truncate(long, 140);
  assert.ok(t.length <= 141);
  assert.ok(t.endsWith('…'));
  const kept = t.slice(0, -1);
  assert.ok(long.startsWith(kept), 'is a prefix of the original');
  assert.equal(long[kept.length], ' ', 'cut lands on a word boundary');
  assert.equal(ashburn.truncate('short', 140), 'short');
});

test('ion: normalises the widget response', async () => {
  const data = await readJson('rinks/ion-leesburg/samples/widget-2026-10-31.json');
  const events = ion.normalize(data);
  assertNormalized(events, 'ion-leesburg');
  assert.ok(events.some((e) => e.sheet === 'Arena') && events.some((e) => e.sheet === 'Ion Rink'));
  const [firstDate, rawFs] = Object.entries(data)
    .flatMap(([date, list]) => list.map((x) => [date, x]))
    .find(([, x]) => x.type === 'Freestyle/Dance');
  const fs = events.find((e) => e.category === 'freestyle' && e.start === `${firstDate}T${rawFs.ts}:00`);
  assert.ok(fs, 'finds the freestyle session');
  assert.equal(fs.title, '', 'drop-in title that just repeats the type is dropped');
  assert.equal(fs.end, `${firstDate}T${rawFs.te}:00`);
  assert.equal(fs.subtitle, '', 'type is not repeated in the subtitle either');
  const game = events.find((e) => / vs\. /.test(e.title));
  assert.equal(game.category, 'hockey');
  assert.ok(events.every((e) => e.sourceId === null), 'widget has no ids');
});

test('ion: classify', () => {
  assert.equal(ion.classify('Public Skate', 'Public Skate'), 'public_skate');
  assert.equal(ion.classify('Freestyle/Dance', 'Freestyle/Dance'), 'freestyle');
  assert.equal(ion.classify('Pick-Up Hockey', 'Pick-Up Hockey'), 'pickup_hockey');
  assert.equal(ion.classify('Adult Hockey 40+', 'Adult Hockey 40+'), 'hockey');
  assert.equal(ion.classify('Loudoun Knights Hockey Club', 'LKHC 12U vs. Navy'), 'hockey');
  assert.equal(ion.classify('Learn To Skate', 'Learn To Skate'), 'learn_to_skate');
  assert.equal(ion.classify('Dance Academy', 'Dance Academy'), 'figure_skating');
  assert.equal(ion.classify('Curling League', 'Curling League'), 'other');
});

test('server: discovers both adapters and skips the template', async () => {
  const adapters = await loadAdapters();
  const slugs = adapters.map((a) => a.slug);
  assert.deepEqual(slugs.sort(), ['ashburn-ice-house', 'ion-leesburg']);
});

test('server: selectRange is inclusive on both ends', () => {
  const ev = (start) => ({ start, end: start, rink: 'x', sheet: 'y' });
  const events = [ev('2026-10-31T23:30:00'), ev('2026-11-01T00:00:00'), ev('2026-11-02T23:59:00'), ev('2026-11-03T00:00:00')];
  assert.deepEqual(selectRange(events, '2026-11-01', '2026-11-02').map((e) => e.start), ['2026-11-01T00:00:00', '2026-11-02T23:59:00']);
});

test('server: EventStore serves from memory, keeps old data on failure, persists a snapshot', async () => {
  const quiet = { log() {}, warn() {}, error() {} };
  const snapshotFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'iceskate-')), 'snap.json');
  let fail = false;
  const calls = { a: 0, b: 0 };
  const mk = (slug, hour) => ({
    slug, name: slug,
    async fetchEvents({ from }) {
      calls[slug] += 1;
      if (fail && slug === 'b') throw new Error('rink down');
      return [{ rink: slug, sheet: 'Main', start: `${from}T${hour}:00:00`, end: `${from}T${hour}:30:00`, title: slug, category: 'other' }];
    },
  });
  const store = new EventStore([mk('a', '10'), mk('b', '11')], { horizonDays: 7, pastDays: 0, snapshotFile, log: quiet });
  await store.refresh();
  const today = addDaysISO(todayISOForTest(), 0);
  let r = await store.getEvents(today, addDaysISO(today, 3));
  assert.equal(r.source, 'cache');
  assert.deepEqual(r.events.map((e) => e.rink), ['a', 'b']);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(calls, { a: 1, b: 1 });

  // A second read does not hit the adapters.
  r = await store.getEvents(today, today);
  assert.deepEqual(calls, { a: 1, b: 1 });

  // A failed refresh keeps b's previous events and reports a stale error.
  fail = true;
  await store.refresh();
  r = await store.getEvents(today, today);
  assert.equal(r.events.filter((e) => e.rink === 'b').length, 1, 'kept previous data for b');
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].rink, 'b');
  assert.equal(r.errors[0].stale, true);

  // Snapshot round-trips into a fresh store.
  const store2 = new EventStore([mk('a', '10'), mk('b', '11')], { horizonDays: 7, pastDays: 0, snapshotFile, log: quiet });
  assert.equal(await store2.loadSnapshot(), true);
  r = await store2.getEvents(today, today);
  assert.equal(r.source, 'cache');
  assert.equal(r.events.length, 2);

  // Out-of-window ranges go live.
  const far = addDaysISO(today, 20);
  r = await store.getEvents(far, far);
  assert.equal(r.source, 'live');
});

function todayISOForTest() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('server: date helpers', () => {
  assert.equal(addDaysISO('2026-10-31', 1), '2026-11-01');
  assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-10-31', '2026-11-13'), 13);
});

// ---------------------------------------------------------------- static build
import { buildSnapshot } from '../scripts/build-static.js';

test('buildSnapshot: merges every rink, sorts, and reports failures without throwing', async () => {
  const ok = { slug: 'a', name: 'A', fetchEvents: async () => [{ rink: 'a', sheet: '1', start: '2026-11-02T10:00:00', end: '2026-11-02T11:00:00' }, { rink: 'a', sheet: '1', start: '2026-11-01T10:00:00', end: '2026-11-01T11:00:00' }] };
  const bad = { slug: 'b', name: 'B', fetchEvents: async () => { throw new Error('boom'); } };
  const snap = await buildSnapshot([ok, bad], { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(snap.source, 'static');
  assert.deepEqual(snap.rinks.map((r) => r.slug), ['a', 'b']);
  assert.deepEqual(snap.events.map((e) => e.start), ['2026-11-01T10:00:00', '2026-11-02T10:00:00']);
  assert.deepEqual(snap.errors, [{ rink: 'b', message: 'boom', stale: false }]);
  assert.ok(ISO_LOCAL.test(snap.generatedAt.replace(/\.\d+Z$/, '')) || snap.generatedAt.endsWith('Z'));
});
