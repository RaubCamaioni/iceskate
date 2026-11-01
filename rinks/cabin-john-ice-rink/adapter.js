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

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, fetchEvents, normalize };
