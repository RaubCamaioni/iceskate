// Cabin John Ice Rink (Rockville, MD; Montgomery Parks) adapter. Schedule pages are hand-edited
// WordPress HTML; lib/montgomeryparks.js parses the weekly public-skate template, the dated stick
// and puck table, the dated freestyle table and the holiday-hours table. See README.md.

import { buildEvents, fetchPages } from '../../lib/montgomeryparks.js';

export const slug = 'cabin-john-ice-rink';
export const name = 'Cabin John Ice Rink';
export const shortName = 'Cabin John';
export const address = '10610 Westlake Dr, Rockville, MD 20852';
export const lat = 39.0372; // Cabin John Regional Park; used for distance sorting and drive times
export const lng = -77.1706;
export const phone = '(301) 765-8620';
export const website = 'https://montgomeryparks.org/parks-and-trails/cabin-john-regional-park/cabin-john-ice-rink/schedules-info/public-sessions/';
export const registerUrl = website; // public skating admission is in person only; stick and puck and freestyle book on ActiveMONTGOMERY
export const onlinePay = false;
export const color = '#5d4037';
export const sheets = ['NHL', 'Olympic'];
// Per-session prices as published on 2026-10-31 (see README.md); shown in the rink row and map popup.
export const prices = [
  {"category": "public_skate", "label": "Public skate", "price": "$9", "note": "tots $5, senior $7 weekdays"},
  {"category": "public_skate", "label": "Cheapskate", "price": "$9", "note": "rental included"},
  {"category": "rental", "label": "Skate rental", "price": "$4"},
  {"category": "stick_and_puck", "label": "Stick and Puck", "price": "$11 to $15", "note": "by session length"},
  {"category": "freestyle", "label": "Freestyle", "price": "$9 per 30 min"},
  {"category": "pass", "label": "Discount ticket book", "price": "$81 for 10", "note": "$8.10 a session"},
];

const BASE = 'https://montgomeryparks.org/parks-and-trails/cabin-john-regional-park/cabin-john-ice-rink/schedules-info/';
export const PAGES = { publicHtml: `${BASE}public-sessions/`, hockeyHtml: `${BASE}hockey/`, figureHtml: `${BASE}figure-skating/`, hoursHtml: BASE };
const RINK = { slug, name, color, defaultSheet: 'NHL' };

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
