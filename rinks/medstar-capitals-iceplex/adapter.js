// MedStar Capitals Iceplex (Arlington) — DaySmart Recreation ("DASH") adapter, company slug "capitals".
// Like Ashburn, every drop-in is event type "k" (Camp); what it is comes from the league's sport:
// 27 Public Skating, 24 Figure Skating (freestyle), 31 Stick n Shoot, 32 Pickup Hockey. So the
// fetch includes `league`. See README.md in this folder.

import { fetchPages, rows, portalUrl, stripHtml, truncate } from '../../lib/daysmart.js';

const COMPANY = 'capitals';
const ICE_RESOURCES = [1, 2]; // Capitals Rink, Arlington Rink

export const slug = 'medstar-capitals-iceplex';
export const name = 'MedStar Capitals Iceplex';
export const shortName = 'Capitals Iceplex';
export const address = '627 N Glebe Rd Suite 800, Arlington, VA 22203';
export const lat = 38.8787195; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.109675;
export const phone = '(571) 224-0555';
export const website = 'https://www.medstarcapitalsiceplex.com/';
// Every drop-in is sold online in DASH (account required); this lists all drop-in activities.
export const registerUrl = `${portalUrl(COMPANY, 'event-registration')}?&program_types=3`;
export const onlinePay = true;
export const color = '#c62828';
export const sheets = ['Capitals Rink', 'Arlington Rink'];
// Per-session prices as published on 2026-10-31 (see README.md); shown in the rink row and map popup.
export const prices = [
  {"category": "public_skate", "label": "Public skate", "price": "$8 to $15", "note": "general $15; adult $9 and 12-and-under $8 sessions; paid online"},
  {"category": "freestyle", "label": "Freestyle", "price": "$10"},
  {"category": "stick_and_puck", "label": "Stick n Shoot", "price": "$20"},
  {"category": "pickup_hockey", "label": "Pickup hockey 18+", "price": "$20", "note": "goalies free"},
  {"category": "public_skate", "label": "Arlington Senior Skate", "price": "$1"},
];

const SPORT_CATEGORY = { 27: 'public_skate', 31: 'stick_and_puck', 32: 'pickup_hockey' };
const HOCKEY_TYPES = new Set(['10', 'g', '9', '24', '25', '31', '15', '13', '26']); // practices, games, HS, county programs
const HIDDEN_TYPES = new Set(['36', '33', 'b', 'r', 'L']); // private, off-ice, block, rental, locker room

// Returns [category, title] or null to hide. `title` is '' when it would only repeat the category.
export function classify({ typeId, sportId, title }) {
  const t = String(title || '').trim();
  const n = t.toLowerCase();
  if (HIDDEN_TYPES.has(typeId)) return null;
  if (typeId === 'k') {
    const sport = Number(sportId);
    if (sport === 27) return ['public_skate', /^public\b/.test(n) ? '' : t]; // keep Recess, Adult Swim, Senior Skate
    if (sport === 24) {
      if (/virtual testing/.test(n)) return null;
      if (/freestyle/.test(n)) return ['freestyle', /^freestyle\b/.test(n) ? '' : t]; // keep "Hybrid Freestyle"
      return ['learn_to_skate', t]; // skating academy classes
    }
    if (sport === 31) return ['stick_and_puck', /^stick n shoot/.test(n) ? '' : t]; // keep "Mini Stick n Shoot"
    if (sport === 32) return /goalie/.test(n) ? null : ['pickup_hockey', /^adult pickup hockey/.test(n) ? '' : t];
    if (/coaches'? daily registration/.test(n)) return null;
    return ['other', t];
  }
  if (typeId === 'c') return ['learn_to_skate', t];
  if (typeId === '8') return [/ltp|learn to play/.test(n) ? 'learn_to_skate' : 'hockey', t];
  if (typeId === '16') return ['figure_skating', t]; // DC Edge synchro
  if (HOCKEY_TYPES.has(typeId)) return ['hockey', t];
  return ['other', t];
}

export function normalize(page) {
  const out = [];
  for (const r of rows(page)) {
    if (!r.a.publish) continue;
    if (!ICE_RESOURCES.includes(Number(r.a.resource_id))) continue;
    const title = String(r.summary.name || r.a.desc || r.typeName || '').trim();
    const c = classify({ typeId: r.typeId, sportId: r.league.sport_id, title });
    if (!c) continue;
    const [category, shownTitle] = c;
    const dropIn = r.typeId === 'k' && category !== 'other';
    out.push({
      rink: slug,
      rinkName: name,
      sheet: (r.resource.name || `Rink ${r.a.resource_id}`).trim(),
      sourceId: r.id,
      start: r.a.start,
      end: r.a.end,
      title: shownTitle,
      subtitle: dropIn ? truncate(stripHtml(r.a.best_description)) : r.typeName || '',
      category,
      capacity: r.a.register_capacity > 0 ? r.a.register_capacity : null,
      color: r.summary.color ?? null,
      registerUrl: dropIn && r.a.register_capacity > 0 ? registerUrl : null,
    });
  }
  return out;
}

export async function fetchEvents({ from, to }) {
  try {
    const pages = await fetchPages({ company: COMPANY, from, to, resources: ICE_RESOURCES, include: 'summary,resource,league' });
    return pages.flatMap(normalize);
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, prices, fetchEvents, normalize, classify };
