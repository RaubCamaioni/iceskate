// Rockville Ice Arena (Rockville, MD) adapter.
// SportsEngine site; its calendar exposes an iCalendar feed of the public-skating and stick-time
// tags (one VEVENT per occurrence, no recurrence rules). The sheet is not published anywhere, so
// every session says "Ice Arena". Freestyle is only a monthly image on the website and is not pulled.
// See README.md.

import { expandICS } from '../../lib/ics.js';

export const slug = 'rockville-ice-arena';
export const name = 'Rockville Ice Arena';
export const shortName = 'Rockville';
export const address = '50 Southlawn Ct, Rockville, MD 20850';
export const lat = 39.1035641; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.1293981;
export const phone = '(301) 315-5650';
export const website = 'https://www.rockvilleicearena.com/page/show/2944804-public-and-stick-time-ice-schedules';
export const registerUrl = website; // prices; public skate and stick time are paid at the desk
export const onlinePay = false;
export const color = '#ef6c00';
export const sheets = ['Ice Arena'];

export const TAGS = { publicSkating: 3080364, stickTime: 3080365 };
export const ICS_URL = `https://www.rockvilleicearena.com/ical_feed?tags=${TAGS.publicSkating},${TAGS.stickTime}`;

// Returns [category, title] or null.
export function classify(summary) {
  const s = String(summary || '').trim().toLowerCase();
  if (s === 'public skating' || /^public skat/.test(s)) return ['public_skate', ''];
  if (/^stick time\s*-\s*youth/.test(s)) return ['stick_and_puck', 'Youth (13 and under)'];
  if (/^stick time/.test(s)) return ['stick_and_puck', ''];
  if (/freestyle/.test(s)) return ['freestyle', ''];
  if (/learn to skate|lesson/.test(s)) return ['learn_to_skate', summary.trim()];
  return ['other', summary.trim()];
}

export function normalize(icsText, { from, to } = {}) {
  const out = [];
  for (const e of expandICS(icsText, { from, to })) {
    const c = classify(e.summary);
    if (!c) continue;
    const [category, title] = c;
    out.push({
      rink: slug, rinkName: name, sheet: sheets[0], sourceId: e.uid || `${category}|${e.start}`,
      start: e.start, end: e.end, title, subtitle: '', category, capacity: null, color, registerUrl: null,
    });
  }
  return out;
}

export async function fetchEvents({ from, to }) {
  try {
    const res = await fetch(ICS_URL, { headers: { accept: 'text/calendar', 'user-agent': 'Mozilla/5.0 (nova-ice-schedules)' } });
    if (!res.ok) throw new Error(`Rockville ICS ${res.status}`);
    return normalize(await res.text(), { from, to });
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, fetchEvents, normalize, classify };
