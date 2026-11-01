// Fairfax Ice Arena — DaySmart Recreation ("DASH") adapter, company slug "fairfax".
// DASH holds public skate, pick-up hockey, lessons and rentals on the one sheet. Freestyle
// sessions are sold separately through Mindbody (HTML only, cookie-gated) and are not pulled yet;
// see README.md in this folder.

import { fetchPages, rows, portalUrl, plainTitle } from '../../lib/daysmart.js';

const COMPANY = 'fairfax';
const ICE_RESOURCES = [1]; // Main Rink; everything else is party rooms and reservation slots

export const slug = 'fairfax-ice-arena';
export const name = 'Fairfax Ice Arena';
export const shortName = 'Fairfax';
export const address = '3779 Pickett Rd, Fairfax, VA 22031';
export const lat = 38.8486715; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.2724089;
export const phone = '(703) 323-1132';
export const website = 'https://www.fairfaxicearena.com/public-skate-hours.html';
export const registerUrl = 'https://www.fairfaxicearena.com/public-skate-hours.html'; // prices; public skate is box office only
export const onlinePay = false;
export const color = '#00695c';
export const sheets = ['Main Rink'];
// Per-session prices as published on 2026-10-31 (see README.md); shown in the rink row and map popup.
export const prices = [
  {"category": "public_skate", "label": "Public skate, weekday", "price": "$10.25"},
  {"category": "public_skate", "label": "Public skate, weekend/holiday", "price": "$11.25"},
  {"category": "rental", "label": "Skate rental", "price": "$4"},
  {"category": "pickup_hockey", "label": "Pick-up hockey", "price": "$20"},
  {"category": "pass", "label": "Public skate punch card", "price": "$83 for 10", "note": "$8.30 a session"},
];
export const pickupRegisterUrl = portalUrl(COMPANY, 'event-registration'); // pick-up hockey is sold here

// event_type_id -> category. 8/16 "Freestyle Session" exist but are unused (freestyle lives in Mindbody).
export const TYPE_CATEGORY = {
  10: 'public_skate', // Public Skate Weekday
  11: 'public_skate', // Public Skate Weekend/Holiday
  k: 'pickup_hockey', // "Camp" = pick-up hockey (player and goalie rows per slot)
  c: 'learn_to_skate', // group lesson classes (their "FREESTYLE 1-5" names are lesson levels)
  8: 'freestyle',
  16: 'freestyle',
  g: 'hockey',
};

export function classify(typeId, title = '') {
  const cat = TYPE_CATEGORY[String(typeId)] ?? null;
  if (cat === 'pickup_hockey' && /goalie/i.test(title)) return null; // the goalie twin of the same slot
  return cat;
}

export function normalize(page) {
  const out = [];
  for (const r of rows(page)) {
    if (!r.a.publish) continue;
    if (!ICE_RESOURCES.includes(Number(r.a.resource_id))) continue;
    let title = String(r.summary.name || r.a.desc || r.typeName || '').trim();
    const category = classify(r.typeId, title);
    if (!category) continue;
    // Class names end with the session dates and the instructor ("(9/28-11/16) M.ALIEVA"); drop both.
    if (category === 'learn_to_skate') title = title.replace(/\s*\([\d/]+\s*-\s*[\d/]+\)\s*\S*\s*$/, '').trim();
    out.push({
      rink: slug,
      rinkName: name,
      sheet: sheets[0],
      sourceId: r.id,
      start: r.a.start,
      end: r.a.end,
      title: category === 'public_skate' ? '' : plainTitle(title, category),
      subtitle: r.typeName || '',
      category,
      capacity: r.a.register_capacity > 0 ? r.a.register_capacity : null,
      color: r.summary.color ?? null,
      registerUrl: category === 'pickup_hockey' && r.a.register_capacity > 0 ? pickupRegisterUrl : null,
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
