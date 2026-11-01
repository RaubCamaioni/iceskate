// Parsers for Montgomery Parks (M-NCPPC) rink schedule pages: Cabin John Ice Rink and Wheaton Ice Arena.
// The pages are hand-edited WordPress blocks, so everything here is tolerant of spacing and dash variants.
//
//  - Public skating: a weekly template (one paragraph or table row per weekday) that is expanded over the
//    requested dates, minus closures from the holiday-hours table and "(No session <date> ...)" notes.
//  - Stick and Puck: a table of dated sessions (Date | Day | Session Time), "(Olympic)" marks the sheet.
//  - Freestyle: a table of dated rows (Date | Day | Code | Session Times) with a comma list of sessions.
// Times are local wall-clock with the meridiem often only on the end time ("11:00-12:00 pm").

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = (n) => String(n).padStart(2, '0');

export const decode = (s) => String(s ?? '')
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/g, '–').replace(/&nbsp;|&#160;/g, ' ').replace(/&#8217;|&rsquo;/g, '’')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
const text = (html) => decode(String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();

const TIME_RE = /(\d{1,2}):(\d{2})\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i;

// "11:00-12:00 pm" -> 11:00 to 12:00; "8:30-10:00 pm" -> 20:30 to 22:00; "9:00 am – 10:30 am" -> as given.
export function parseTimeRange(s) {
  const m = TIME_RE.exec(String(s));
  if (!m) return null;
  const to24 = (h, ap) => (Number(h) % 12) + (ap === 'pm' ? 12 : 0);
  let ap1 = m[3]?.toLowerCase();
  let ap2 = m[6]?.toLowerCase();
  if (!ap1 && !ap2) ap1 = ap2 = 'am';
  if (!ap2) ap2 = ap1;
  if (!ap1) ap1 = ap2;
  let sh = to24(m[1], ap1);
  const eh = to24(m[4], ap2);
  const smin = sh * 60 + Number(m[2]);
  const emin = eh * 60 + Number(m[5]);
  if (smin > emin && !m[3]) sh = to24(m[1], ap2 === 'pm' ? 'am' : 'pm'); // meridiem was only on the end
  if (sh * 60 + Number(m[2]) > emin) return null;
  return { start: `${pad(sh)}:${m[2]}:00`, end: `${pad(eh)}:${m[5]}:00`, rest: (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() };
}

// Session label -> [category, title]; sheet is read separately from "(Olympic)" / "(NHL)".
export function classifyLabel(label) {
  const s = String(label).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const n = s.toLowerCase();
  if (/closed/.test(n)) return null;
  if (/stick/.test(n)) return ['stick_and_puck', ''];
  if (/pick.?up/.test(n)) return ['pickup_hockey', ''];
  if (/cheapskate/.test(n)) return ['public_skate', 'Cheapskate (includes rental)'];
  if (/adult (skate|session)/.test(n)) return ['public_skate', 'Adults only (18+)'];
  if (/parent and tot/.test(n)) return ['public_skate', 'Parent and Tot'];
  if (/disco/.test(n)) return ['public_skate', 'Disco Skate'];
  if (/public (skat|session)/.test(n)) return ['public_skate', ''];
  if (/ice dance|dance session|skating skills/.test(n)) return ['figure_skating', s];
  if (/\bfs\b|freestyle/.test(n)) return ['freestyle', /mixed/.test(n) ? 'Mixed use' : /low/.test(n) ? 'Low freestyle' : ''];
  if (/lesson|learn to skate|class/.test(n)) return ['learn_to_skate', s];
  return ['other', s];
}
export const sheetOf = (label, fallback) => (/\(olympic\)/i.test(label) ? 'Olympic' : /\(nhl\)/i.test(label) ? 'NHL' : fallback);

// "November 26, 2026", "Nov. 3", "December 12" -> YYYY-MM-DD, choosing the year nearest the window when none is given.
export function resolveDate(s, { from, to }) {
  const m = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/.exec(String(s));
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3)));
  if (mi < 0) return null;
  const day = Number(m[2]);
  if (m[3]) return `${m[3]}-${pad(mi + 1)}-${pad(day)}`;
  const fy = Number(from.slice(0, 4));
  const candidates = [fy - 1, fy, fy + 1].map((y) => `${y}-${pad(mi + 1)}-${pad(day)}`);
  const dist = (d) => (d < from ? daysBetween(d, from) : d > to ? daysBetween(to, d) : 0);
  return candidates.sort((a, b) => dist(a) - dist(b))[0];
}
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.abs(Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000;
}
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
const weekdayOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

// Table rows -> arrays of cell texts (with <br> kept as newlines).
export function tableRows(html) {
  const out = [];
  for (const t of String(html).match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows = [];
    for (const tr of t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map((c) => text(c));
      if (cells.length) rows.push(cells);
    }
    out.push(rows);
  }
  return out;
}

// Weekly public-skating template from either page style. Returns [{ day, onlyDates: [..]|null, sessions: [{ start, end, label, skipDates }] }].
export function parseWeekly(html) {
  const out = [];
  const dayRe = new RegExp(`^(${DAYS.join('|')})s?\\b\\s*(?:[-–]\\s*(.+))?$`, 'i');
  const parseLines = (lines) => lines.map((line) => {
    const t = parseTimeRange(line);
    if (!t) return null;
    const skipDates = [...t.rest.matchAll(/no sessions? (?:on )?([A-Za-z]{3,9}\.? \d{1,2}(?:,? \d{4})?)/gi)].map((m) => m[1]);
    return { start: t.start, end: t.end, label: t.rest.replace(/\([^)]*no session[^)]*\)/gi, '').trim(), skipDates };
  }).filter(Boolean);
  // Style 1: <p><strong>Monday</strong><br>8:00-9:15 am Cheapskate<br>...</p>
  for (const m of String(html).matchAll(/<p[^>]*>\s*<strong>\s*([A-Za-z]+)\s*<\/strong>([\s\S]*?)<\/p>/gi)) {
    const dm = dayRe.exec(decode(m[1]).trim());
    if (!dm) continue;
    const sessions = parseLines(text(m[2]).split('\n'));
    if (sessions.length) out.push({ day: DAYS.find((d) => d.toLowerCase() === dm[1].toLowerCase()), onlyDates: null, sessions });
  }
  // Style 2: table rows Day | Time<br>Time | Session<br>Session
  for (const rows of tableRows(html)) {
    for (const cells of rows) {
      const dm = dayRe.exec(cells[0] ?? '');
      if (!dm || cells.length < 2) continue;
      const times = cells[1].split('\n').map((s) => s.trim()).filter(Boolean);
      const labels = (cells[2] ?? '').split('\n').map((s) => s.trim());
      const sessions = times.map((tt, i) => { const t = parseTimeRange(tt); return t ? { start: t.start, end: t.end, label: labels[i] || labels[0] || 'Public Session', skipDates: [] } : null; }).filter(Boolean);
      const onlyDates = dm[2] ? dm[2].split(/\s*(?:,|and|&)\s*/i).map((s) => s.trim()).filter((s) => /[A-Za-z]{3,}\s*\d/.test(s)) : null;
      if (sessions.length) out.push({ day: DAYS.find((d) => d.toLowerCase() === dm[1].toLowerCase()), onlyDates, sessions });
    }
  }
  return out;
}

// Dated rows (Date | Day | ...): returns [{ date, cells }] for rows whose first cell is a date.
export function datedRows(html, range) {
  const out = [];
  for (const rows of tableRows(html)) {
    for (const cells of rows) {
      const date = resolveDate(cells[0] ?? '', range);
      if (date) out.push({ date, cells });
    }
  }
  return out;
}

// Holiday-hours rows and "Important Dates" lines -> { 'YYYY-MM-DD': { closed, closesAt, opensAt } }.
export function parseClosures(html, range) {
  const out = {};
  const note = (date, s) => {
    const n = s.toLowerCase();
    const cur = out[date] ?? (out[date] = { closed: false, closesAt: null, opensAt: null });
    if (/closed\b/.test(n) && !/closes at/.test(n)) cur.closed = true;
    const c = /closes at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(n);
    if (c) cur.closesAt = `${pad((Number(c[1]) % 12) + (c[3] === 'am' ? 0 : 12))}:${c[2] ?? '00'}:00`;
    const o = /opens at (noon|(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)/.exec(n);
    if (o) cur.opensAt = o[1] === 'noon' ? '12:00:00' : `${pad((Number(o[2]) % 12) + (o[4] === 'pm' ? 12 : 0))}:${o[3] ?? '00'}:00`;
  };
  for (const { date, cells } of datedRows(html, range)) note(date, cells.slice(1).join(' '));
  for (const m of text(html).matchAll(/([A-Za-z]{3,9}\.? \d{1,2},? \d{4})\s*[-–]\s*([^\n]+)/g)) {
    const date = resolveDate(m[1], range);
    if (date) note(date, m[2]);
  }
  return out;
}

// Expand the weekly template over [from, to], honouring closures and per-session skip dates.
export function expandWeekly(template, range, closures = {}) {
  const out = [];
  const byDay = new Map();
  for (const t of template) byDay.set(t.day, [...(byDay.get(t.day) ?? []), t]);
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const c = closures[d];
    if (c?.closed) continue;
    for (const t of byDay.get(DAYS[weekdayOf(d)]) ?? []) {
      if (t.onlyDates && !t.onlyDates.some((x) => resolveDate(x, range) === d)) continue;
      for (const s of t.sessions) {
        if (s.skipDates.some((x) => resolveDate(x, range) === d)) continue;
        if (c?.closesAt && s.start >= c.closesAt) continue;
        if (c?.opensAt && s.end <= c.opensAt) continue;
        out.push({ date: d, start: s.start, end: s.end, label: s.label });
      }
    }
  }
  return out;
}

// Dated session tables (stick and puck, freestyle): every time range in the cells after the date.
export function expandDated(html, range, defaultLabel) {
  const out = [];
  for (const { date, cells } of datedRows(html, range)) {
    if (date < range.from || date > range.to) continue;
    const body = cells.slice(1).filter((c) => !DAYS.includes(c.trim())).join(', ');
    if (/closed/i.test(body) && !TIME_RE.test(body)) continue;
    for (const part of body.split(/,|\n|\//)) {
      const t = parseTimeRange(part);
      if (!t) continue;
      // "(Olympic)" alone means the default session type on that sheet; keep the sheet note for sheetOf().
      const parens = (t.rest.match(/\([^)]*\)/g) ?? []).join(' ');
      const bare = t.rest.replace(/\([^)]*\)/g, ' ').replace(/\b[A-Z]{4}\d{4}\b/i, '').replace(/\s+/g, ' ').trim();
      out.push({ date, start: t.start, end: t.end, label: `${bare || defaultLabel} ${parens}`.trim() });
    }
  }
  return out;
}

// Everything for one rink: pages are { publicHtml, hockeyHtml, figureHtml, hoursHtml }.
export function buildEvents(pages, rink, range) {
  const closures = { ...parseClosures(pages.hoursHtml ?? '', range), ...parseClosures(pages.publicHtml ?? '', range) };
  const raw = [
    ...expandWeekly(parseWeekly(pages.publicHtml ?? ''), range, closures),
    ...expandDated(pages.hockeyHtml ?? '', range, 'Stick and Puck'),
    ...expandDated(pages.figureHtml ?? '', range, 'Freestyle'),
  ];
  const out = new Map();
  for (const r of raw) {
    const c = classifyLabel(r.label);
    if (!c) continue;
    const [category, title] = c;
    const sheet = sheetOf(r.label, rink.defaultSheet);
    const start = `${r.date}T${r.start}`;
    const key = `${category}|${start}|${sheet}`;
    if (out.has(key)) continue;
    out.set(key, {
      rink: rink.slug, rinkName: rink.name, sheet, sourceId: key, start, end: `${r.date}T${r.end}`,
      title, subtitle: '', category, capacity: null, color: rink.color, registerUrl: null,
    });
  }
  return [...out.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export async function fetchPages(urls) {
  const pages = {};
  for (const [key, url] of Object.entries(urls)) {
    const res = await fetch(url, { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (nova-ice-schedules)' } });
    if (!res.ok) throw new Error(`montgomeryparks ${res.status} for ${key}`);
    pages[key] = await res.text();
  }
  return pages;
}
