// Loudoun Ice Centre (Sterling) adapter.
// The rink's website calendar is an embedded public Google Calendar; its ICS feed is fetched and
// expanded locally (lib/ics.js). One small sheet, so every session has the same sheet name.

import { expandICS } from '../../lib/ics.js';

export const slug = 'loudoun-ice-centre';
export const name = 'Loudoun Ice Centre';
export const shortName = 'Loudoun Ice';
export const address = '22149 Davis Dr Suite 155, Sterling, VA 20164';
export const lat = 38.9967937; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.4248634;
export const phone = '(703) 444-0600';
export const website = 'https://www.loudounice.com/calendar';
export const registerUrl = 'https://www.loudounice.com/public-skating'; // walk-in prices; no online checkout found
export const onlinePay = false;
export const color = '#2e7d32';
export const sheets = ['Studio Rink'];

export const CALENDAR_ID = 'scheduler@loudounice.com';
export const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;

export function classify(summary) {
  const s = String(summary || '').toLowerCase();
  if (/closed/.test(s)) return null;
  if (/learn to skate|lesson/.test(s)) return 'learn_to_skate';
  if (/stick|shoot/.test(s)) return 'stick_and_puck';
  if (/open hockey|pick ?up|drop.?in hockey/.test(s)) return 'pickup_hockey';
  if (/broomball|hockey|rookie program|clinic|3v3|tourney|wally cup|goalie|player/.test(s)) return 'hockey';
  if (/skate|skating/.test(s)) return 'public_skate'; // public skate, cheap skate, holiday-themed skates
  if (/camp|party|parent|training|coach/.test(s)) return 'other';
  return 'other';
}

export function normalize(icsText, { from, to } = {}) {
  const out = [];
  for (const e of expandICS(icsText, { from, to })) {
    const category = classify(e.summary);
    if (!category) continue;
    const title = e.summary.trim();
    out.push({
      rink: slug,
      rinkName: name,
      sheet: sheets[0],
      sourceId: `${e.uid}|${e.start}`,
      start: e.start,
      end: e.end,
      title: category === 'public_skate' && /^public skat/i.test(title) ? '' : title,
      subtitle: e.description.trim().slice(0, 160) || null,
      category,
      capacity: null,
      color,
      registerUrl: null,
    });
  }
  return out;
}

export async function fetchEvents({ from, to }) {
  try {
    const res = await fetch(ICS_URL, { headers: { accept: 'text/calendar' } });
    if (!res.ok) throw new Error(`Loudoun Ice Centre ICS ${res.status}`);
    return normalize(await res.text(), { from, to });
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, fetchEvents, normalize, classify };
