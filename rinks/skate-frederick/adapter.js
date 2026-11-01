// SKATE Frederick (Frederick, MD) adapter.
// WordPress site with The Events Calendar; its REST API returns every event with categories.
// The sheet is only in the description's first line ("<h4>Sheet 1</h4>"). See README.md.

export const slug = 'skate-frederick';
export const name = 'SKATE Frederick';
export const shortName = 'Frederick';
export const address = '1288 Riverbend Way, Frederick, MD 21701';
export const lat = 39.4456169; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.3889433;
export const phone = '(301) 662-7362';
export const website = 'https://skatefrederick.com/public-skating/';
export const registerUrl = 'https://skatefrederick.com/public-skating/'; // prices; sessions are pay at the door
export const onlinePay = false;
export const color = '#ad1457';
export const sheets = ['Sheet 1', 'Sheet 2'];

const API = 'https://skatefrederick.com/wp-json/tribe/events/v1/events';

// category slug -> category, first match wins. Events with no category are private rentals.
const CATEGORY_RULES = [
  ['public-skating', 'public_skate'],
  ['stick-and-shoot', 'stick_and_puck'],
  ['freestyle', 'freestyle'],
  ['learn-to-skate', 'learn_to_skate'],
  ['specialty-training', 'learn_to_skate'],
  ['camps-clinics', 'learn_to_skate'],
  ['ice-hockey', 'hockey'],
  ['figure-skating', 'figure_skating'],
];

export function classify(slugs) {
  const set = new Set(slugs);
  for (const [s, c] of CATEGORY_RULES) if (set.has(s)) return c;
  return set.size ? 'other' : null;
}

const decode = (s) => String(s ?? '').replace(/&#0?38;|&amp;/g, '&').replace(/&#8211;|&ndash;/g, '–').replace(/&#8217;/g, '’').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// Pure: one REST page -> normalised events.
export function normalize(page) {
  const out = [];
  for (const e of page.events ?? []) {
    if (e.all_day || e.hide_from_listings) continue;
    const category = classify((e.categories ?? []).map((c) => c.slug));
    if (!category) continue;
    const desc = String(e.description ?? '');
    const sheet = /<h4>\s*(Sheet\s*\d)\s*<\/h4>/i.exec(desc)?.[1].replace(/\s+/, ' ') ?? 'Rink';
    let title = decode(e.title);
    if (category === 'public_skate') title = title.replace(/^public skating\s*[–-]?\s*/i, '').trim(); // "Public Skating – Cheapskate" -> "Cheapskate"
    else if (/^(freestyle|stick & shoot|learn to skate)$/i.test(title)) title = '';
    const start = String(e.start_date).replace(' ', 'T');
    const end = String(e.end_date).replace(' ', 'T');
    out.push({
      rink: slug, rinkName: name, sheet,
      sourceId: `${start}|${end}|${sheet}|${decode(e.title)}`, // ids of recurring occurrences are not stable
      start, end, title, subtitle: '', category, capacity: null, color, registerUrl: null,
    });
  }
  // The feed occasionally lists the same event twice.
  return [...new Map(out.map((e) => [e.sourceId, e])).values()];
}

export async function fetchEvents({ from, to }) {
  try {
    const events = [];
    for (let page = 1; page <= 20; page++) {
      const qs = new URLSearchParams({ start_date: from, end_date: to, per_page: '50', page: String(page) });
      const res = await fetch(`${API}?${qs}`, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (nova-ice-schedules)' } });
      if (res.status === 400 && page > 1) break; // past the last page
      if (!res.ok) throw new Error(`Tribe events ${res.status}`);
      const body = await res.json();
      events.push(...normalize(body));
      if (page >= (body.total_pages ?? 1)) break;
    }
    return [...new Map(events.map((e) => [e.sourceId, e])).values()];
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, fetchEvents, normalize, classify };
