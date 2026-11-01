// Template adapter. Copy this folder to rinks/<slug>/ and fill in the blanks.
// The server loads every rinks/*/adapter.js automatically (folders starting with "_" are skipped).
//
// Contract:
//   fetchEvents({ from, to })  -> Promise<NormalizedEvent[]>   from/to are YYYY-MM-DD, inclusive, local dates
//   normalize(raw)             -> NormalizedEvent[]            pure, used by tests against samples/
//
// NormalizedEvent: { rink, rinkName, sheet, sourceId, start, end, title, subtitle, category, capacity, color, registerUrl }
//   start/end are "YYYY-MM-DDTHH:MM:SS" local wall-clock (America/New_York).
//   category is one of: public_skate, freestyle, stick_and_puck, pickup_hockey, learn_to_skate, hockey, figure_skating, other

export const slug = 'rink-slug';
export const name = 'Rink Name';
export const shortName = 'Rink';
export const address = '';
export const lat = null; // decimal degrees, for distance sorting (geocode the address once)
export const lng = null;
export const phone = '';
export const website = '';
export const registerUrl = null; // online checkout, or a page with walk-in prices
export const onlinePay = false; // true when registerUrl is an actual online checkout
export const color = '#888888';
export const sheets = [];
// Per-session prices: [{ category, label, price, note? }]; category is a session category, 'rental' or 'pass'.
export const prices = [];

export function classify(/* vendor fields */) {
  return 'other';
}

export function normalize(raw) {
  return [];
}

export async function fetchEvents({ from, to }) {
  try {
    // const res = await fetch(...);
    // return normalize(await res.json());
    return [];
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, prices, fetchEvents, normalize, classify };
