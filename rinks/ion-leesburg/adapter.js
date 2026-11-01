// ION International Training Center (Leesburg) — schedule.ionitc.com widget API adapter.
// See README.md in this folder for the endpoint research.
// The endpoint has no CORS headers, which is why this runs on the server.

const BASE = 'https://schedule.ionitc.com/api/schedule';

export const slug = 'ion-leesburg';
export const name = 'ION International Training Center';
export const shortName = 'ION Leesburg';
export const address = '19201 Compass Creek Pkwy, Leesburg, VA 20175';
export const lat = 39.0854516; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.5650061;
export const phone = '(703) 951-0050';
export const website = 'https://www.ionitc.com/iceschedule';
// ION has no online purchase for public skate. Checked on 2026-10-31 both logged out and inside a
// FinnlyConnect account: no memberships, passes, store, or drop-in registration exist. Pay at the door.
// The card button therefore goes to the page with admission prices and arrival advice.
export const registerUrl = 'https://www.ionitc.com/skatingprograms';
export const accountUrl = 'https://ionitc.finnlyconnect.com/Account/CreateAccount';
export const onlinePay = false; // registerUrl is the price page; payment is at the door
export const color = '#c0392b';
export const sheets = ['Arena', 'Ion Rink'];
// Per-session prices as published on 2026-10-31 (see README.md); shown in the rink row and map popup.
export const prices = [
  {"category": "public_skate", "label": "Public skate", "price": "$20", "note": "ages 12 and under $17; rental included"},
];

const HOCKEY_TYPES = /loudoun knights|lkhc|\bwlc\b|nvshl|tph|adult hockey|adult league|my hockey|hockey/i;
const FIGURE_TYPES = /dance academy|developmental academy|future champs|ice prodigies|synchronized/i;

export function classify(type, title) {
  const t = (type || '').trim();
  const n = `${t} ${title || ''}`.toLowerCase();
  if (/public skate/i.test(t)) return 'public_skate';
  if (/freestyle|dance/i.test(t) && !FIGURE_TYPES.test(t)) return 'freestyle';
  if (/stick/i.test(n)) return 'stick_and_puck';
  if (/pick-?up/i.test(t)) return 'pickup_hockey';
  if (/learn to skate/i.test(t)) return 'learn_to_skate';
  if (FIGURE_TYPES.test(t)) return 'figure_skating';
  // League games are often filed under a generic type ("Facility", a sponsor name) with the
  // league in the title, so the title counts too.
  if (HOCKEY_TYPES.test(n) || /\bvs\.?\b|\b3v3\b/.test(n)) return 'hockey';
  return 'other';
}

// Pure: widget response ({ "YYYY-MM-DD": [ {ts, te, title, desc, type, style, rink, locker} ] }) -> normalised events.
export function normalize(data) {
  const out = [];
  for (const [date, events] of Object.entries(data ?? {})) {
    for (const e of events ?? []) {
      const type = (e.type || '').trim();
      const rawTitle = (e.title || type || 'Ice time').trim();
      const category = classify(type, rawTitle);
      // Drop-in sessions are titled with their own type ("Freestyle/Dance", "Public Skate").
      // The category already says that, so leave the title empty rather than repeat it.
      const dropIn = ['public_skate', 'freestyle', 'stick_and_puck', 'pickup_hockey', 'learn_to_skate'].includes(category);
      const title = dropIn && rawTitle.toLowerCase() === type.toLowerCase() ? '' : rawTitle;
      const subtitle = [e.desc, title && title !== type ? type : ''].filter(Boolean).join(' · ');
      out.push({
        rink: slug,
        rinkName: name,
        sheet: (e.rink || '').trim() || 'Rink',
        sourceId: null,
        start: `${date}T${e.ts}:00`,
        end: `${date}T${e.te}:00`,
        title,
        subtitle,
        category,
        capacity: null,
        color: e.style ? `#${e.style.replace('#', '').slice(0, 6)}` : null,
        registerUrl: null, // ION sells public skate at the door only; the rink-level registerUrl points to walk-in prices
      });
    }
  }
  return out;
}

function daysBetween(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export async function fetchEvents({ from, to }) {
  try {
    const daysAhead = Math.max(0, daysBetween(from, to));
    const res = await fetch(`${BASE}?${new URLSearchParams({ startDate: from, daysAhead: String(daysAhead) })}`);
    if (!res.ok) throw new Error(`schedule.ionitc.com ${res.status} ${res.statusText}`);
    return normalize(await res.json());
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, accountUrl, onlinePay, color, sheets, prices, fetchEvents, normalize, classify };
