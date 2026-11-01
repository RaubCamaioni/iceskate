// SkateQuest (Reston) — DaySmart Recreation ("DASH") adapter, company slug "skatequest".
// See README.md in this folder. Classified by event_type_id; freestyle is published as
// back-to-back 30-minute slots that the frontend merges.

import { fetchPages, rows, portalUrl, plainTitle } from '../../lib/daysmart.js';

const COMPANY = 'skatequest';
const ICE_RESOURCES = [1, 2]; // NHL Rink, Olympic Rink

export const slug = 'skatequest-reston';
export const name = 'SkateQuest Reston';
export const shortName = 'SkateQuest';
export const address = '1800 Michael Faraday Ct, Reston, VA 20190';
export const phone = '(703) 709-1010';
export const website = 'https://www.skatequest.com/public-events';
export const registerUrl = 'https://www.skatequest.com/public-events'; // prices; public sessions are pay at the door
export const onlinePay = false;
export const color = '#b8860b';
export const sheets = ['NHL Rink', 'Olympic Rink'];
export const calendarUrl = portalUrl(COMPANY, 'calendar');

// event_type_id -> category. Anything not listed is hidden (rentals, blocks, locker rooms, parties, maintenance).
export const TYPE_CATEGORY = {
  8: 'public_skate',
  16: 'freestyle',
  25: 'freestyle', // Low Freestyle
  26: 'freestyle', // High Freestyle
  21: 'freestyle', // High Stroking
  24: 'freestyle', // Low Stroking
  23: 'freestyle', // Dance Ice
  10: 'pickup_hockey',
  17: 'stick_and_puck',
  18: 'learn_to_skate', // LTS
  11: 'learn_to_skate', // LTS Practice Time
  c: 'learn_to_skate',
  13: 'hockey', // Hockey Lesson Ice
  27: 'hockey', // Hockey Camp
  7: 'hockey', // Reston Raiders Hockey Club
  19: 'hockey', // NVSHL game
  9: 'hockey', // Tournament
  g: 'hockey',
  15: 'figure_skating', // Ice Show
  22: 'other', // Special Event
  12: 'other', // Fundraiser
  k: 'other',
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

export default { slug, name, shortName, address, phone, website, registerUrl, onlinePay, color, sheets, fetchEvents, normalize, classify };
