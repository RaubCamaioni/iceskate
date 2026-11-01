// Minimal iCalendar (.ics) parser and recurrence expander, enough for rink Google Calendars.
//
// Supports: VEVENT with DTSTART/DTEND (TZID, UTC "Z", floating), RRULE FREQ=DAILY|WEEKLY|MONTHLY|YEARLY
// with INTERVAL/COUNT/UNTIL/BYDAY (weekly), EXDATE, RECURRENCE-ID overrides, STATUS:CANCELLED.
// All-day events (VALUE=DATE) are skipped: they are closures and notes, not sessions.
// Output times are wall-clock strings "YYYY-MM-DDTHH:MM:SS" in `zone` (default America/New_York).

const DAY_MS = 86400000;
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const pad = (n) => String(n).padStart(2, '0');
const fmt = (f) => `${f.y}-${pad(f.m)}-${pad(f.d)}T${pad(f.h)}:${pad(f.mi)}:${pad(f.s)}`;

const fmtCache = new Map();
function partsIn(zone) {
  if (!fmtCache.has(zone)) fmtCache.set(zone, new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  return fmtCache.get(zone);
}
// UTC instant -> wall-clock fields in zone.
export function msToZoned(ms, zone) {
  const p = {};
  for (const { type, value } of partsIn(zone).formatToParts(new Date(ms))) p[type] = value;
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), s: Number(p.second) };
}
// Wall-clock fields in zone -> UTC instant. Two-pass offset guess handles DST edges well enough.
export function zonedToMs(f, zone) {
  const asUtc = Date.UTC(f.y, f.m - 1, f.d, f.h, f.mi, f.s);
  if (!zone || zone === 'UTC') return asUtc;
  let ms = asUtc;
  for (let i = 0; i < 2; i++) {
    const z = msToZoned(ms, zone);
    ms += asUtc - Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi, z.s);
  }
  return ms;
}

function parseDT(value, params) {
  if (params.VALUE === 'DATE') {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    return m ? { date: true, y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6], tz: m[7] ? 'UTC' : params.TZID || null };
}

// Parse the text into plain VEVENT objects. Lines are unfolded first (RFC 5545 folding).
export function parseICS(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const m = /^([A-Za-z0-9-]+)((?:;[^:]*)?):(.*)$/.exec(line);
    if (!m) continue;
    const name = m[1].toUpperCase();
    const params = {};
    for (const p of m[2].split(';').filter(Boolean)) { const [k, v = ''] = p.split('='); params[k.toUpperCase()] = v.replace(/^"|"$/g, ''); }
    const value = m[3];
    const unescape = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
    switch (name) {
      case 'UID': cur.uid = value; break;
      case 'SUMMARY': cur.summary = unescape(value); break;
      case 'DESCRIPTION': cur.description = unescape(value); break;
      case 'LOCATION': cur.location = unescape(value); break;
      case 'STATUS': cur.status = value.toUpperCase(); break;
      case 'DTSTART': cur.dtstart = parseDT(value, params); break;
      case 'DTEND': cur.dtend = parseDT(value, params); break;
      case 'RRULE': cur.rrule = value; break;
      case 'RECURRENCE-ID': cur.recurrenceId = parseDT(value, params); break;
      case 'EXDATE': for (const v of value.split(',')) { const d = parseDT(v, params); if (d) cur.exdates.push(d); } break;
      default: break;
    }
  }
  return events;
}

const instantOf = (f) => (f.date ? Date.UTC(f.y, f.m - 1, f.d) : zonedToMs(f, f.tz || 'America/New_York'));

// Day index (UTC days) of a fields object, ignoring time of day; used to step recurrences in the rule's own frame.
const dayIndex = (f) => Math.floor(Date.UTC(f.y, f.m - 1, f.d) / DAY_MS);
const fieldsOnDay = (dayIdx, f) => { const d = new Date(dayIdx * DAY_MS); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: f.h, mi: f.mi, s: f.s, tz: f.tz }; };

// Yield the start fields of every occurrence of (dtstart, rrule) that begins before `endMs`.
function* occurrences(dtstart, rrule, endMs) {
  const parts = Object.fromEntries(rrule.split(';').map((p) => p.split('=')));
  const freq = parts.FREQ;
  const interval = Math.max(1, Number(parts.INTERVAL || 1));
  const count = parts.COUNT ? Number(parts.COUNT) : Infinity;
  let until = Infinity;
  if (parts.UNTIL) {
    const u = parseDT(parts.UNTIL, {}) || parseDT(parts.UNTIL, { VALUE: 'DATE' }); // Google writes date-only UNTILs
    until = u ? (u.date ? Date.UTC(u.y, u.m - 1, u.d, 23, 59, 59) : zonedToMs(u, u.tz || dtstart.tz || 'America/New_York')) : Infinity;
  }
  const base = dayIndex(dtstart);
  let n = 0;
  const emit = function* (dayIdx) {
    if (dayIdx < base) return false;
    const f = fieldsOnDay(dayIdx, dtstart);
    const ms = instantOf(f);
    if (ms > until || ms > endMs) return true; // stop
    n += 1;
    yield f;
    return n >= count;
  };
  if (freq === 'WEEKLY') {
    const days = parts.BYDAY ? parts.BYDAY.split(',').map((c) => DAYS.indexOf(c.slice(-2))).filter((i) => i >= 0).sort() : [((base % 7) + 11) % 7];
    const weekStart = base - (((base % 7) + 11) % 7); // 1970-01-01 was a Thursday (index 4)
    for (let w = 0; w < 100000; w += interval) {
      for (const wd of days) { const stop = yield* emit(weekStart + w * 7 + wd); if (stop) return; }
    }
  } else if (freq === 'DAILY') {
    for (let i = 0; i < 100000; i += interval) { const stop = yield* emit(base + i); if (stop) return; }
  } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
    for (let i = 0; i < 2000; i += interval) {
      const y = dtstart.y + (freq === 'YEARLY' ? i : Math.floor((dtstart.m - 1 + i) / 12));
      const m = freq === 'YEARLY' ? dtstart.m : ((dtstart.m - 1 + i) % 12) + 1;
      if (new Date(Date.UTC(y, m - 1, dtstart.d)).getUTCMonth() !== m - 1) continue; // e.g. 31st in a short month
      const stop = yield* emit(dayIndex({ y, m, d: dtstart.d })); if (stop) return;
    }
  } else {
    yield* emit(base);
  }
}

// Expand every event into concrete sessions whose start falls in [from, to] (YYYY-MM-DD, inclusive, in `zone`).
export function expandICS(text, { from, to, zone = 'America/New_York' } = {}) {
  const events = parseICS(text);
  const lo = from ? `${from}T00:00:00` : '';
  const hi = to ? `${to}T23:59:59` : '9999';
  const endMs = to ? zonedToMs({ y: +to.slice(0, 4), m: +to.slice(5, 7), d: +to.slice(8, 10), h: 23, mi: 59, s: 59 }, zone) : Infinity;
  const key = (f) => fmt(msToZoned(instantOf(f), zone));
  // Overrides (RECURRENCE-ID) replace one occurrence of the master with the same UID.
  const overrides = new Map();
  for (const e of events) if (e.recurrenceId && e.uid) overrides.set(`${e.uid}|${key(e.recurrenceId)}`, e);
  const out = [];
  const push = (e, startF, duration) => {
    if (e.status === 'CANCELLED') return;
    const startMs = instantOf(startF);
    const s = fmt(msToZoned(startMs, zone));
    if (s < lo || s > hi) return;
    out.push({ uid: e.uid ?? null, summary: e.summary ?? '', description: e.description ?? '', location: e.location ?? '', start: s, end: fmt(msToZoned(startMs + duration, zone)) });
  };
  for (const e of events) {
    if (!e.dtstart || e.dtstart.date) continue;
    const duration = e.dtend && !e.dtend.date ? Math.max(0, instantOf(e.dtend) - instantOf(e.dtstart)) : 0;
    if (e.recurrenceId) { push(e, e.dtstart, duration); continue; }
    if (!e.rrule) { push(e, e.dtstart, duration); continue; }
    const ex = new Set(e.exdates.map(key));
    for (const f of occurrences(e.dtstart, e.rrule, endMs)) {
      const k = key(f);
      if (ex.has(k)) continue;
      if (e.uid && overrides.has(`${e.uid}|${k}`)) continue; // emitted from its own VEVENT above
      push(e, f, duration);
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.summary.localeCompare(b.summary));
}
