// Haymarket IcePlex — DaySmart Recreation ("DASH") adapter, company slug "haymarketice".
// See README.md in this folder. Sessions are classified by event_type_id because the titles
// are free text with typos ("Frestyle").

import { fetchPages, rows, portalUrl, plainTitle } from '../../lib/daysmart.js';

const COMPANY = 'haymarketice';
const ICE_RESOURCES = [1, 7]; // Rink - North, Rink - South; everything else is locker/party rooms

export const slug = 'haymarket-iceplex';
export const name = 'Haymarket IcePlex';
export const shortName = 'Haymarket';
export const address = '15155 Washington St, Haymarket, VA 20169';
export const lat = 38.8124349; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.6402902;
export const phone = '(703) 753-4423';
export const website = portalUrl(COMPANY, 'calendar');
export const registerUrl = 'https://www.haymarketiceplex.com/page/show/8611769-pricing'; // prices; sessions are pay at the door
export const onlinePay = false;
export const color = '#00838f';
export const sheets = ['Rink - North', 'Rink - South'];
// Per-session prices as published on 2026-10-31 (see README.md); shown in the rink row and map popup.
export const prices = [
  {"category": "public_skate", "label": "Public skate", "price": "$10"},
  {"category": "rental", "label": "Skate rental", "price": "$4"},
  {"category": "freestyle", "label": "Freestyle", "price": "$15"},
  {"category": "stick_and_puck", "label": "Stick N Shoot", "price": "$15"},
  {"category": "pass", "label": "Freestyle / Stick 10-pass", "price": "$135", "note": "$13.50 a session"},
];

// event_type_id -> category. Anything not listed is hidden (rentals, blocks, locker rooms, parties, private lessons).
export const TYPE_CATEGORY = {
  8: 'public_skate',
  12: 'freestyle',
  11: 'stick_and_puck',
  14: 'stick_and_puck', // 12U Stick and Shoot
  16: 'pickup_hockey',
  19: 'learn_to_skate',
  15: 'learn_to_skate', // Learn to Play Hockey / Future Caps
  18: 'other', // Home Schooling Ice
  20: 'hockey', // Power Skating
  21: 'hockey', // Hockey Skills Session
  9: 'hockey', // Piedmont Hockey Club
  g: 'hockey', // Game
  c: 'learn_to_skate', // Class
  k: 'other', // Camp
};

export function classify(typeId) {
  return TYPE_CATEGORY[String(typeId)] ?? null;
}

export function normalize(page) {
  const out = [];
  for (const r of rows(page)) {
    if (!r.a.publish) continue;
    if (!ICE_RESOURCES.includes(Number(r.a.resource_id))) continue;
    const category = classify(r.typeId);
    if (!category) continue;
    const title = String(r.summary.name || r.a.desc || r.typeName || '').trim();
    out.push({
      rink: slug,
      rinkName: name,
      sheet: (r.resource.name || `Rink ${r.a.resource_id}`).trim(),
      sourceId: r.id,
      start: r.a.start,
      end: r.a.end,
      title: plainTitle(title, category),
      subtitle: r.typeName || '',
      category,
      capacity: r.a.register_capacity > 0 ? r.a.register_capacity : null,
      color: r.summary.color ?? null,
      registerUrl: null,
    });
  }
  return out;
}

export async function fetchEvents({ from, to }) {
  try {
    const pages = await fetchPages({ company: COMPANY, from, to, resources: ICE_RESOURCES, eventTypes: Object.keys(TYPE_CATEGORY) });
    return pages.flatMap(normalize);
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, prices, fetchEvents, normalize, classify };
