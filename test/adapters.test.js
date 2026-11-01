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

test('server: discovers every rink adapter and skips the template', async () => {
  const adapters = await loadAdapters();
  const slugs = adapters.map((a) => a.slug);
  for (const s of ['ashburn-ice-house', 'ion-leesburg', 'loudoun-ice-centre', 'haymarket-iceplex', 'skatequest-reston']) assert.ok(slugs.includes(s), s);
  assert.ok(!slugs.includes('rink-slug'), 'template skipped');
  assert.equal(new Set(slugs).size, slugs.length, 'slugs unique');
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
  assert.ok(snap.generatedAt.endsWith('Z'));
});

test('buildSnapshot: a failed rink reuses its events from the previous snapshot and is flagged stale', async () => {
  const ok = { slug: 'a', name: 'A', fetchEvents: async () => [{ rink: 'a', sheet: '1', start: '2026-11-02T10:00:00', end: '2026-11-02T11:00:00' }] };
  const bad = { slug: 'b', name: 'B', fetchEvents: async () => { throw new Error('403'); } };
  const previous = { fetchedAt: '2026-10-31T09:00:00.000Z', events: [
    { rink: 'b', sheet: '1', start: '2026-11-03T10:00:00', end: '2026-11-03T11:00:00' },
    { rink: 'b', sheet: '1', start: '2026-12-25T10:00:00', end: '2026-12-25T11:00:00' }, // outside the window
    { rink: 'a', sheet: '1', start: '2026-11-04T10:00:00', end: '2026-11-04T11:00:00' }, // not reused: a succeeded
  ] };
  const snap = await buildSnapshot([ok, bad], { from: '2026-11-01', to: '2026-11-30', previous });
  assert.deepEqual(snap.events.map((e) => `${e.rink} ${e.start}`), ['a 2026-11-02T10:00:00', 'b 2026-11-03T10:00:00']);
  assert.deepEqual(snap.errors, [{ rink: 'b', message: '403', stale: true }]);
  assert.equal(snap.fetchedAt, '2026-10-31T09:00:00.000Z', 'fetchedAt is the oldest data shown');
});

// ---------------------------------------------------------------- ICS expander + Loudoun Ice Centre
import { expandICS, parseICS } from '../lib/ics.js';
import * as loudoun from '../rinks/loudoun-ice-centre/adapter.js';

const SYNTHETIC_ICS = [
  'BEGIN:VCALENDAR', 'X-WR-TIMEZONE:America/New_York',
  // weekly Wed+Fri series, one date excluded, one occurrence moved by an override
  'BEGIN:VEVENT', 'UID:a', 'SUMMARY:Cheap Skate', 'DTSTART;TZID=America/New_York:20261104T113000', 'DTEND;TZID=America/New_York:20261104T130000',
  'RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=WE,FR', 'EXDATE;TZID=America/New_York:20261111T113000', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a', 'RECURRENCE-ID;TZID=America/New_York:20261113T113000', 'SUMMARY:Cheap Skate (moved)', 'DTSTART;TZID=America/New_York:20261113T100000', 'DTEND;TZID=America/New_York:20261113T110000', 'END:VEVENT',
  // expired series with a date-only UNTIL (Google writes these) must not leak into the window
  'BEGIN:VEVENT', 'UID:b', 'SUMMARY:Old Skate', 'DTSTART;TZID=America/New_York:20220328T110000', 'DTEND;TZID=America/New_York:20220328T123000', 'RRULE:FREQ=WEEKLY;UNTIL=20220531;BYDAY=MO', 'END:VEVENT',
  // UTC-stamped single event: 20:00Z on Nov 7 is 3pm EST (after the DST change on Nov 1)
  'BEGIN:VEVENT', 'UID:c', 'SUMMARY:Public Skate', 'DTSTART:20261107T200000Z', 'DTEND:20261107T213000Z', 'END:VEVENT',
  // all-day closure is skipped; cancelled instance is skipped
  'BEGIN:VEVENT', 'UID:d', 'SUMMARY:CLOSED', 'DTSTART;VALUE=DATE:20261105', 'DTEND;VALUE=DATE:20261106', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:e', 'SUMMARY:Stick & Shoot', 'STATUS:CANCELLED', 'DTSTART;TZID=America/New_York:20261106T100000', 'DTEND;TZID=America/New_York:20261106T110000', 'END:VEVENT',
  // COUNT-limited daily series
  'BEGIN:VEVENT', 'UID:f', 'SUMMARY:Camp', 'DTSTART;TZID=America/New_York:20261102T090000', 'DTEND;TZID=America/New_York:20261102T120000', 'RRULE:FREQ=DAILY;COUNT=3', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('expandICS: weekly BYDAY with EXDATE and RECURRENCE-ID override', () => {
  const ev = expandICS(SYNTHETIC_ICS, { from: '2026-11-02', to: '2026-11-15' }).filter((e) => e.uid === 'a');
  assert.deepEqual(ev.map((e) => `${e.start} ${e.summary}`), [
    '2026-11-04T11:30:00 Cheap Skate',
    '2026-11-06T11:30:00 Cheap Skate',
    // 11-11 excluded by EXDATE
    '2026-11-13T10:00:00 Cheap Skate (moved)',
  ]);
  assert.equal(ev[0].end, '2026-11-04T13:00:00');
});

test('expandICS: date-only UNTIL ends a series; COUNT; UTC conversion; all-day and cancelled skipped', () => {
  const ev = expandICS(SYNTHETIC_ICS, { from: '2026-11-01', to: '2026-11-30' });
  assert.ok(!ev.some((e) => e.uid === 'b'), 'expired series leaked');
  assert.deepEqual(ev.filter((e) => e.uid === 'f').map((e) => e.start.slice(0, 10)), ['2026-11-02', '2026-11-03', '2026-11-04']);
  const utc = ev.find((e) => e.uid === 'c');
  assert.equal(utc.start, '2026-11-07T15:00:00');
  assert.equal(utc.end, '2026-11-07T16:30:00');
  assert.ok(!ev.some((e) => e.uid === 'd' || e.uid === 'e'));
});

test('parseICS unfolds lines and unescapes text', () => {
  const [e] = parseICS('BEGIN:VEVENT\r\nSUMMARY:Public\r\n  Skate\, Fri\r\nDTSTART:20261107T200000Z\r\nEND:VEVENT\r\n');
  assert.equal(e.summary, 'Public Skate, Fri');
  assert.equal(e.dtstart.tz, 'UTC');
});

test('loudoun: classify', () => {
  assert.equal(loudoun.classify('Cheap Skate'), 'public_skate');
  assert.equal(loudoun.classify('Halloween Public Skate'), 'public_skate');
  assert.equal(loudoun.classify("Stick N' Shoot"), 'stick_and_puck');
  assert.equal(loudoun.classify('Learn to Skate'), 'learn_to_skate');
  assert.equal(loudoun.classify('GLOW BROOMBALL'), 'hockey');
  assert.equal(loudoun.classify('Goalie Rookie Program'), 'hockey');
  assert.equal(loudoun.classify('Youth Open Hockey'), 'pickup_hockey');
  assert.equal(loudoun.classify('CLOSED - Happy Easter!'), null);
});

test('loudoun: normalize the trimmed real sample', async () => {
  const ics = await fs.readFile(path.join(ROOT, 'rinks/loudoun-ice-centre/samples/basic-trimmed.ics'), 'utf8');
  const events = loudoun.normalize(ics, { from: '2026-01-01', to: '2026-12-31' });
  assertNormalized(events, 'loudoun-ice-centre');
  assert.ok(events.every((e) => e.sheet === 'Studio Rink'));
  assert.ok(!events.some((e) => /closed/i.test(e.title)), 'closures are not sessions');
  const utc = events.find((e) => e.sourceId.includes('2026-05-10'));
  assert.equal(utc?.start, '2026-05-10T11:15:00', '15:15Z in May is 11:15 EDT');
});

// ---------------------------------------------------------------- Haymarket IcePlex + SkateQuest (DaySmart)
import * as haymarket from '../rinks/haymarket-iceplex/adapter.js';
import * as skatequest from '../rinks/skatequest-reston/adapter.js';
import { plainTitle, rows } from '../lib/daysmart.js';

test('daysmart: plainTitle blanks titles that only repeat the category', () => {
  assert.equal(plainTitle('Public Skate', 'public_skate'), '');
  assert.equal(plainTitle('Public Skate Session', 'public_skate'), '');
  assert.equal(plainTitle('Frestyle ', 'freestyle'), 'Frestyle');
  assert.equal(plainTitle('Freestyle', 'freestyle'), '');
  assert.equal(plainTitle('Stick n Shoot', 'stick_and_puck'), '');
  assert.equal(plainTitle('Public Skate- HALLOWEEN SKATE in costume', 'public_skate'), 'Public Skate- HALLOWEEN SKATE in costume');
  assert.equal(plainTitle('Public Skate', 'other'), 'Public Skate');
});

test('haymarket: normalises the sample, classifies by event type id, keeps only ice sheets', async () => {
  const page = await readJson('rinks/haymarket-iceplex/samples/events-sample.json');
  const events = haymarket.normalize(page);
  assertNormalized(events, 'haymarket-iceplex');
  assert.ok(events.every((e) => haymarket.sheets.includes(e.sheet)), 'only North/South');
  const raw = [...rows(page)];
  const expected = raw.filter((r) => r.a.publish && [1, 7].includes(Number(r.a.resource_id)) && haymarket.classify(r.typeId)).length;
  assert.equal(events.length, expected);
  assert.equal(haymarket.classify('8'), 'public_skate');
  assert.equal(haymarket.classify(12), 'freestyle');
  assert.equal(haymarket.classify('L'), null);
  assert.equal(haymarket.classify('13'), null, 'private lessons hidden');
});

test('skatequest: normalises the sample and classifies by event type id', async () => {
  const page = await readJson('rinks/skatequest-reston/samples/events-sample.json');
  const events = skatequest.normalize(page);
  assertNormalized(events, 'skatequest-reston');
  assert.ok(events.every((e) => skatequest.sheets.includes(e.sheet)), 'only NHL/Olympic');
  assert.equal(skatequest.classify('8'), 'public_skate');
  assert.equal(skatequest.classify('26'), 'freestyle');
  assert.equal(skatequest.classify('10'), 'pickup_hockey');
  assert.equal(skatequest.classify('14'), null, 'ice maintenance hidden');
});

// ---------------------------------------------------------------- Capitals, Mount Vernon, Prince William
import * as capitals from '../rinks/medstar-capitals-iceplex/adapter.js';
import * as mountvernon from '../rinks/mount-vernon-recenter/adapter.js';
import * as pwic from '../rinks/prince-william-ice-center/adapter.js';

test('capitals: classifies drop-ins by league sport, hides private/goalie/virtual rows', async () => {
  const page = await readJson('rinks/medstar-capitals-iceplex/samples/events-sample.json');
  const events = capitals.normalize(page);
  assertNormalized(events, 'medstar-capitals-iceplex');
  assert.deepEqual(events.map((e) => e.category).sort(), ['freestyle', 'public_skate', 'stick_and_puck']);
  assert.ok(events.every((e) => e.title === ''), 'plain drop-in titles are blanked');
  assert.ok(events.every((e) => e.registerUrl === capitals.registerUrl), 'drop-ins link to DASH checkout');
  assert.deepEqual(capitals.classify({ typeId: 'k', sportId: 27, title: 'Recess PM Nov' }), ['public_skate', 'Recess PM Nov']);
  assert.deepEqual(capitals.classify({ typeId: 'k', sportId: 24, title: 'Hybrid Freestyle' }), ['freestyle', 'Hybrid Freestyle']);
  assert.equal(capitals.classify({ typeId: 'k', sportId: 24, title: 'Virtual Testing' }), null);
  assert.equal(capitals.classify({ typeId: 'k', sportId: 32, title: 'Adult Pickup Hockey Goalie - Evening' }), null);
  assert.deepEqual(capitals.classify({ typeId: 'c', sportId: null, title: 'Basic 1- Sunday 4:15pm' }), ['learn_to_skate', 'Basic 1- Sunday 4:15pm']);
  assert.equal(capitals.classify({ typeId: '36', sportId: null, title: 'Private' }), null);
});

test('mount vernon: parses the usedirect ticket listing', async () => {
  const html = await fs.readFile(path.join(ROOT, 'rinks/mount-vernon-recenter/samples/usedirect-search-sample.html'), 'utf8');
  const events = mountvernon.normalize(html);
  assertNormalized(events, 'mount-vernon-recenter');
  assert.equal(events.length, 12);
  assert.deepEqual([...new Set(events.map((e) => e.category))].sort(), ['pickup_hockey', 'public_skate', 'stick_and_puck']);
  const first = events[0];
  assert.match(first.registerUrl, /Details\.aspx\?session_id=\d+$/);
  assert.equal(first.start, '2026-11-01T12:00:00');
  assert.equal(first.end, '2026-11-01T14:00:00');
  assert.deepEqual(mountvernon.classify('Adult PS 7:00 PM'), ['public_skate', 'Adults only (14+)']);
});

test('prince william: parses a Frontline monthly page', async () => {
  const html = await fs.readFile(path.join(ROOT, 'rinks/prince-william-ice-center/samples/monthly-public-2026-11.html'), 'utf8');
  const events = pwic.normalize(html, 'public_skate');
  assertNormalized(events, 'prince-william-ice-center');
  assert.ok(events.length >= 30, `expected a month of public sessions, got ${events.length}`);
  assert.ok(events.every((e) => ['NHL', 'Olympic'].includes(e.sheet)), 'sheet is NHL or Olympic');
  // the month grid also shows the trailing days of December; fetchEvents trims to the requested range
  assert.ok(events.filter((e) => e.start.startsWith('2026-11-')).length >= 30);
  assert.ok(events.every((e) => /^2026-1[12]-/.test(e.start)));
  const stick = pwic.normalize(await fs.readFile(path.join(ROOT, 'rinks/prince-william-ice-center/samples/monthly-stick-2026-11.html'), 'utf8'), 'stick_and_puck');
  assert.ok(stick.length > 0 && stick.every((e) => e.category === 'stick_and_puck'));
});

// ---------------------------------------------------------------- Fairfax Ice Arena (DaySmart)
import * as fairfax from '../rinks/fairfax-ice-arena/adapter.js';

test('fairfax: public skate by type id, pick-up hockey from Camp rows, rentals hidden', async () => {
  const page = await readJson('rinks/fairfax-ice-arena/samples/events-sample.json');
  const events = fairfax.normalize(page);
  assertNormalized(events, 'fairfax-ice-arena');
  assert.deepEqual(events.map((e) => e.category).sort(), ['learn_to_skate', 'pickup_hockey', 'public_skate', 'public_skate']);
  const pickup = events.find((e) => e.category === 'pickup_hockey');
  assert.equal(pickup.registerUrl, fairfax.pickupRegisterUrl);
  assert.equal(pickup.capacity, 30);
  assert.ok(events.filter((e) => e.category === 'public_skate').every((e) => e.title === ''));
  assert.equal(fairfax.classify('k', 'Pick-Up Hockey Goalies - Friday'), null);
  assert.equal(fairfax.classify('r', 'Kilmer ES Skate Night'), null);
});

test('every rink adapter has coordinates within about 50 miles of Leesburg for distance sorting', async () => {
  for (const a of await loadAdapters()) {
    assert.ok(Number.isFinite(a.lat) && Number.isFinite(a.lng), `${a.slug} lat/lng`);
    assert.ok(a.lat > 38.3 && a.lat < 39.9 && a.lng > -78.3 && a.lng < -76.5, `${a.slug} is near Leesburg: ${a.lat},${a.lng}`);
  }
});

// ---------------------------------------------------------------- Mount Vernon PDF calendars
import { parseTimeRun, parseCalendarPdf } from '../rinks/mount-vernon-recenter/pdf.js';

test('mount vernon pdf: time runs with the meridiem only on the end time', () => {
  assert.deepEqual(parseTimeRun('11:30-1:00pm (B)'), { start: '11:30:00', end: '13:00:00', sheet: 'Blue Rink', adultOnly: false });
  assert.deepEqual(parseTimeRun('12:00-2:00 pm (R)'), { start: '12:00:00', end: '14:00:00', sheet: 'Red Rink', adultOnly: false });
  assert.deepEqual(parseTimeRun('10:45-12:00pm(B)'), { start: '10:45:00', end: '12:00:00', sheet: 'Blue Rink', adultOnly: false });
  assert.deepEqual(parseTimeRun('5:30-7:00 am (R)'), { start: '05:30:00', end: '07:00:00', sheet: 'Red Rink', adultOnly: false });
  assert.deepEqual(parseTimeRun('*7:00-8:30 pm(R)*'), { start: '19:00:00', end: '20:30:00', sheet: 'Red Rink', adultOnly: true });
  assert.equal(parseTimeRun('9:00\uFFFD10:30 am (B)')?.start, '09:00:00', 'mangled dash');
  assert.equal(parseTimeRun('No Session'), null);
});

test('mount vernon pdf: parses the public and hockey calendars into dated sessions', async () => {
  const pub = await parseCalendarPdf(await fs.readFile(path.join(ROOT, 'rinks/mount-vernon-recenter/samples/mvice.pdf')));
  assert.ok(pub.length > 100, `public sessions: ${pub.length}`);
  const mon = pub.filter((s) => s.date === '2026-11-02').map((s) => `${s.start.slice(0, 5)}-${s.end.slice(0, 5)} ${s.sheet}${s.adultOnly ? ' adult' : ''}`).sort();
  assert.deepEqual(mon, ['07:00-09:00 Blue Rink', '09:15-11:15 Blue Rink', '15:45-17:15 Red Rink', '19:00-20:30 Red Rink adult']);
  assert.ok(pub.every((s) => /^2026-1[01]-\d{2}$/.test(s.date)), 'October and November pages');
  const hockey = await parseCalendarPdf(await fs.readFile(path.join(ROOT, 'rinks/mount-vernon-recenter/samples/mvice-hockey.pdf')));
  const nov2 = hockey.filter((s) => s.date === '2026-11-02').map((s) => `${s.label} ${s.start.slice(0, 5)}`).sort();
  assert.deepEqual(nov2, ['PUH 11:30', 'SNP 05:15', 'SNP 14:00']);
  const events = mountvernon.fromCalendar(hockey, 'mvice-hockey.pdf');
  assertNormalized(events, 'mount-vernon-recenter');
  assert.deepEqual([...new Set(events.map((e) => e.category))].sort(), ['pickup_hockey', 'stick_and_puck']);
});

test('mount vernon: ticket-store rows enrich matching PDF sessions with sign-up links', async () => {
  const html = await fs.readFile(path.join(ROOT, 'rinks/mount-vernon-recenter/samples/usedirect-search-sample.html'), 'utf8');
  const tickets = mountvernon.normalize(html);
  const pdf = [{ rink: 'mount-vernon-recenter', sheet: 'Red Rink', sourceId: 'x', start: '2026-11-01T12:00:00', end: '2026-11-01T14:00:00', title: '', subtitle: '', category: 'public_skate', capacity: null, registerUrl: null }];
  const [e] = mountvernon.enrich(pdf, tickets);
  assert.equal(e.capacity, 200);
  assert.match(e.registerUrl, /session_id=\d+$/);
  assert.equal(e.sheet, 'Red Rink', 'sheet comes from the PDF');
});

// ---------------------------------------------------------------- SKATE Frederick (The Events Calendar REST)
import * as frederick from '../rinks/skate-frederick/adapter.js';

test('frederick: classifies by category slug, reads the sheet from the description, dedupes', async () => {
  const page = await readJson('rinks/skate-frederick/samples/events-sample.json');
  const events = frederick.normalize(page);
  assertNormalized(events, 'skate-frederick');
  assert.deepEqual(events.map((e) => `${e.category} ${e.sheet} "${e.title}"`), [
    'hockey Sheet 2 "Victory Hockey"', 'learn_to_skate Sheet 1 ""', 'freestyle Sheet 1 ""', 'public_skate Sheet 1 ""', 'stick_and_puck Sheet 1 ""',
  ]);
  assert.equal(events[3].start, '2026-10-31T14:00:00');
  assert.equal(frederick.classify(['public-skating']), 'public_skate');
  assert.equal(frederick.classify(['figure-skating', 'freestyle']), 'freestyle');
  assert.equal(frederick.classify([]), null, 'uncategorised = private rental');
  const twice = frederick.normalize({ events: [page.events[3], page.events[3]] });
  assert.equal(twice.length, 1);
});

// ---------------------------------------------------------------- Rockville Ice Arena (SportsEngine ICS)
import * as rockville from '../rinks/rockville-ice-arena/adapter.js';

test('rockville: reads the tagged ICS feed', async () => {
  const ics = await fs.readFile(path.join(ROOT, 'rinks/rockville-ice-arena/samples/feed-2026-10-31.ics'), 'utf8');
  const events = rockville.normalize(ics, { from: '2026-11-01', to: '2026-11-30' });
  assertNormalized(events, 'rockville-ice-arena');
  assert.ok(events.length > 30, `november sessions: ${events.length}`);
  assert.deepEqual([...new Set(events.map((e) => e.category))].sort(), ['public_skate', 'stick_and_puck']);
  assert.ok(events.some((e) => e.title === 'Youth (13 and under)'));
  assert.ok(events.every((e) => e.sourceId.startsWith('event_')), 'uids kept');
  assert.deepEqual(rockville.classify('Public Skating'), ['public_skate', '']);
  assert.deepEqual(rockville.classify('Stick Time - Youth'), ['stick_and_puck', 'Youth (13 and under)']);
});

// ---------------------------------------------------------------- Montgomery Parks: Cabin John + Wheaton
import * as mp from '../lib/montgomeryparks.js';
import * as cabinjohn from '../rinks/cabin-john-ice-rink/adapter.js';
import * as wheaton from '../rinks/wheaton-ice-arena/adapter.js';

const mpPages = async (slug) => {
  const dir = path.join(ROOT, 'rinks', slug, 'samples');
  const read = (f) => fs.readFile(path.join(dir, `${f}-2026-10-31.html`), 'utf8');
  return { publicHtml: await read('public-sessions'), hockeyHtml: await read('hockey'), figureHtml: await read('figure-skating'), hoursHtml: await read('schedules-hub') };
};

test('montgomery parks: time ranges with one or two meridiems', () => {
  assert.deepEqual([mp.parseTimeRange('11:00-12:00 pm Parent and Tot').start, mp.parseTimeRange('11:00-12:00 pm Parent and Tot').end], ['11:00:00', '12:00:00']);
  assert.deepEqual([mp.parseTimeRange('8:30-10:00 pm Public Skate').start, mp.parseTimeRange('8:30-10:00 pm Public Skate').end], ['20:30:00', '22:00:00']);
  assert.deepEqual([mp.parseTimeRange('9:00 am – 10:30 am').start, mp.parseTimeRange('12:30 pm- 2:00 pm').end], ['09:00:00', '14:00:00']);
  assert.equal(mp.parseTimeRange('10:45 am-12:15 pm, ').start, '10:45:00');
  assert.equal(mp.parseTimeRange('Rink closed'), null);
  assert.equal(mp.resolveDate('November 26, 2026', { from: '2026-11-01', to: '2026-12-05' }), '2026-11-26');
  assert.equal(mp.resolveDate('Nov. 3', { from: '2026-11-01', to: '2026-12-05' }), '2026-11-03');
  assert.equal(mp.resolveDate('January 2', { from: '2026-12-20', to: '2027-01-24' }), '2027-01-02');
});

test('cabin john: weekly public template, dated stick and puck with sheets, freestyle, closures', async () => {
  const range = { from: '2026-11-01', to: '2026-12-13' };
  const events = cabinjohn.normalize(await mpPages('cabin-john-ice-rink'), range);
  assertNormalized(events, 'cabin-john-ice-rink');
  const mon = events.filter((e) => e.start.startsWith('2026-11-02') && e.category === 'public_skate').map((e) => `${e.start.slice(11, 16)} ${e.title}`);
  assert.deepEqual(mon, ['08:00 Cheapskate (includes rental)', '09:30 Adults only (18+)', '11:00 Parent and Tot', '12:30 ', '16:30 ']);
  assert.equal(events.filter((e) => e.start.startsWith('2026-11-26')).length, 0, 'Thanksgiving closed');
  assert.ok(!events.some((e) => e.start === '2026-12-12T20:30:00'), 'ice show night skipped');
  const snp = events.filter((e) => e.category === 'stick_and_puck' && e.start.startsWith('2026-11-02')).map((e) => `${e.start.slice(11, 16)} ${e.sheet}`);
  assert.deepEqual(snp, ['06:45 NHL', '12:00 Olympic']);
  assert.ok(events.some((e) => e.category === 'freestyle' && e.start === '2026-11-02T05:30:00' && e.title === 'Mixed use'));
  assert.ok(!events.some((e) => e.category === 'other'), 'nothing left unclassified');
});

test('wheaton: table-style weekly template with a date-restricted Monday row', async () => {
  const range = { from: '2026-11-01', to: '2026-12-31' };
  const events = wheaton.normalize(await mpPages('wheaton-ice-arena'), range);
  assertNormalized(events, 'wheaton-ice-arena');
  const mondays = events.filter((e) => e.category === 'public_skate' && new Date(e.start).getDay() === 1).map((e) => e.start.slice(0, 10));
  assert.deepEqual([...new Set(mondays)], ['2026-11-02', '2026-12-28'], 'Monday public sessions only on the listed dates');
  const thu = events.filter((e) => e.start.startsWith('2026-11-05') && e.category === 'public_skate').map((e) => `${e.start.slice(11, 16)}-${e.end.slice(11, 16)} ${e.title}`);
  assert.deepEqual(thu, ['09:00-10:30 Adults only (18+)', '10:45-11:45 Parent and Tot', '12:30-14:00 ', '16:15-17:45 ']);
  assert.ok(events.filter((e) => e.start.startsWith('2026-12-24')).every((e) => e.start.slice(11) < '15:00:00'), 'Christmas Eve closes at 3pm');
  assert.ok(events.some((e) => e.category === 'stick_and_puck' && e.start === '2026-11-06T20:15:00'));
});

test('every rink adapter publishes per-session prices', async () => {
  for (const a of await loadAdapters()) {
    assert.ok(Array.isArray(a.prices) && a.prices.length > 0, `${a.slug} prices`);
    assert.ok(a.prices.some((p) => p.category === 'public_skate'), `${a.slug} has a public skate price`);
    for (const p of a.prices) assert.ok(p.label && /\$\d/.test(p.price), `${a.slug} price row ${JSON.stringify(p)}`);
  }
});
