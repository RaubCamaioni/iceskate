// Wheaton Ice Arena (Wheaton, MD; Montgomery Parks) adapter. Same page style as Cabin John,
// except the weekly public-skate schedule is a table (Day | Time | Session) and there is one sheet.
// See README.md.

import { buildEvents, fetchPages } from '../../lib/montgomeryparks.js';

export const slug = 'wheaton-ice-arena';
export const name = 'Wheaton Ice Arena';
export const shortName = 'Wheaton';
export const address = '11717 Orebaugh Ave, Wheaton, MD 20902';
export const lat = 39.0492351; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.0338942;
export const phone = '(301) 905-3000';
export const website = 'https://montgomeryparks.org/parks-and-trails/wheaton-ice-arena/schedules-fees/wheaton-ice-arena-public-skating-sessions/';
export const registerUrl = website; // public skating admission is in person only
export const onlinePay = false;
export const color = '#4e342e';
export const sheets = ['Rink'];
// Per-session prices as published on 2026-10-31 (see README.md); shown in the rink row and map popup.
export const prices = [
  {"category": "public_skate", "label": "Public skate", "price": "$9", "note": "tots $5, senior $7 weekdays"},
  {"category": "public_skate", "label": "Cheapskate", "price": "$9", "note": "rental included"},
  {"category": "rental", "label": "Skate rental", "price": "$4"},
  {"category": "stick_and_puck", "label": "Stick and Puck", "price": "$11 to $15", "note": "by session length"},
  {"category": "freestyle", "label": "Freestyle", "price": "$9 per 30 min"},
  {"category": "pass", "label": "Discount ticket book", "price": "$81 for 10", "note": "$8.10 a session"},
];

const BASE = 'https://montgomeryparks.org/parks-and-trails/wheaton-ice-arena/schedules-fees/';
export const PAGES = { publicHtml: `${BASE}wheaton-ice-arena-public-skating-sessions/`, hockeyHtml: `${BASE}wheaton-ice-arena-hockey-sessions/`, figureHtml: `${BASE}wheaton-ice-arena-figure-skating-sessions/`, hoursHtml: BASE };
const RINK = { slug, name, color, defaultSheet: 'Rink' };

export function normalize(pages, range) {
  return buildEvents(pages, RINK, range);
}

export async function fetchEvents({ from, to }) {
  try {
    return normalize(await fetchPages(PAGES), { from, to });
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, prices, fetchEvents, normalize };
