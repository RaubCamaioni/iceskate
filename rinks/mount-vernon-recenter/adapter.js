// Mount Vernon RECenter Ice Arena (Fairfax County Park Authority) adapter.
// No API exists. The county sells drop-in tickets through a US eDirect ("Parktakes") store whose
// search page is server-rendered HTML: one table row per session. This adapter reads that.
// Only sessions sold online appear: complete for Stick and Puck and Pickup Hockey, but some
// weekday-morning public skates (door sales only) and all freestyle/ice-dance are missing. The
// county's PDF calendars have everything; see README.md for the PDF URLs.
// The listing does not say which sheet (Red or Blue Rink) a session is on.

export const slug = 'mount-vernon-recenter';
export const name = 'Mount Vernon RECenter';
export const shortName = 'Mt Vernon';
export const address = '2017 Belle View Blvd, Alexandria, VA 22307';
export const phone = '(703) 768-3224';
export const website = 'https://www.fairfaxcounty.gov/parks/recenter/mount-vernon/ice-arena';
export const SEARCH_URL = 'https://fairfax.usedirect.com/FairfaxFCPAWeb/ACTIVITIES/Search.aspx?category_name=ICE%20TICKETS&place_id=7949';
export const registerUrl = SEARCH_URL; // every listed session is sold online here
export const onlinePay = true;
export const color = '#6a1b9a';
export const sheets = ['Ice Arena'];

// search_text -> what the store returns. Freestyle and ice dance currently return nothing.
const SEARCHES = ['public', 'stick and puck', 'pickup hockey'];

// Session codes in the listing: PS / Adult PS = public skate, SNP = stick and puck, PUH = pickup hockey.
export function classify(sessionCode) {
  const s = String(sessionCode || '').trim();
  if (/^adult ps\b/i.test(s)) return ['public_skate', 'Adults only (14+)'];
  if (/^ps\b/i.test(s)) return ['public_skate', ''];
  if (/^snp\b/i.test(s)) return ['stick_and_puck', ''];
  if (/^puh\b/i.test(s)) return ['pickup_hockey', ''];
  if (/freestyle|fs\b/i.test(s)) return ['freestyle', ''];
  if (/dance/i.test(s)) return ['figure_skating', s];
  return ['other', s];
}

const pad = (n) => String(n).padStart(2, '0');
function to24(h, m, ap) {
  let hh = Number(h) % 12;
  if (/pm/i.test(ap)) hh += 12;
  return `${pad(hh)}:${m}:00`;
}
const cell = (row, label) => {
  const m = new RegExp(`data-label="${label}"[^>]*>([\\s\\S]*?)</td>`, 'i').exec(row);
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '';
};

// Pure: the search page HTML -> normalised events.
export function normalize(html) {
  const out = [];
  const seen = new Set();
  for (const row of String(html).split(/<tr\b/).slice(1)) {
    const session = cell(row, 'Session');
    const schedule = cell(row, 'Schedule');
    const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(schedule);
    if (!session || !m) continue;
    const id = /session_id=(\d+)/.exec(row)?.[1] ?? `${schedule}|${session}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const date = `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
    const [category, title] = classify(session);
    const restrictions = cell(row, 'Restrictions');
    const seats = Number(cell(row, 'Seats').replace(/\D/g, '')) || null;
    out.push({
      rink: slug,
      rinkName: name,
      sheet: sheets[0],
      sourceId: String(id),
      start: `${date}T${to24(m[4], m[5], m[6])}`,
      end: `${date}T${to24(m[7], m[8], m[9])}`,
      title,
      subtitle: restrictions && !/^none$/i.test(restrictions) ? `Ages ${restrictions}` : '',
      category,
      capacity: seats,
      color,
      registerUrl: /session_id=\d+/.test(row) ? `https://fairfax.usedirect.com/FairfaxFCPAWeb/ACTIVITIES/Details.aspx?session_id=${id}` : registerUrl,
    });
  }
  return out;
}

export async function fetchEvents({ from, to }) {
  try {
    const lo = `${from}T00:00:00`;
    const hi = `${to}T23:59:59`;
    const events = [];
    for (const q of SEARCHES) {
      const res = await fetch(`${SEARCH_URL}&search_text=${encodeURIComponent(q)}`, { headers: { 'user-agent': 'Mozilla/5.0 (nova-ice-schedules)', accept: 'text/html' } });
      if (!res.ok) throw new Error(`usedirect ${res.status} for "${q}"`);
      events.push(...normalize(await res.text()));
    }
    const byId = new Map(events.map((e) => [e.sourceId, e]));
    return [...byId.values()].filter((e) => e.start >= lo && e.start <= hi);
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, phone, website, registerUrl, onlinePay, color, sheets, fetchEvents, normalize, classify };
