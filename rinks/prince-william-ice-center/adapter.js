// Prince William Ice Center (Dale City / Woodbridge) adapter.
// The rink schedules in Frontline Connect, a ColdFusion app with a GET-addressable monthly
// page per session type (public, stick-n-shoot, freestyle, pickup hockey). Server-rendered
// HTML, one <td> per day with the sheet name and "H:MM AM - H:MM PM" ranges. No JSON, no CORS.
// Lessons and leagues are not exposed by type, so they are not shown. See README.md.

export const slug = 'prince-william-ice-center';
export const name = 'Prince William Ice Center';
export const shortName = 'Prince William';
export const address = '5180 Dale Blvd, Woodbridge, VA 22193';
export const phone = '(703) 730-8423';
export const website = 'https://www.innovativesportsva.com/';
export const registerUrl = 'https://www.innovativesportsva.com/page/show/8780814-public-skate'; // prices; pay at the door
export const onlinePay = false;
export const color = '#283593';
export const sheets = ['NHL', 'Olympic'];

const BASE = 'https://pwice.frontline-connect.com/monthlysched.cfm?fac=pwice&facid=1';
// Frontline session ids -> category
export const SESSIONS = { 1: 'public_skate', 3: 'stick_and_puck', 4: 'freestyle', 2: 'pickup_hockey' };
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const pad = (n) => String(n).padStart(2, '0');
const to24 = (h, m, ap) => `${pad((Number(h) % 12) + (/pm/i.test(ap) ? 12 : 0))}:${m}:00`;
const sheetName = (s) => { const t = s.trim().toLowerCase(); return t === 'nhl' ? 'NHL' : t === 'olympic' ? 'Olympic' : s.trim(); };

// Pure: one monthly page -> normalised events of the given category.
export function normalize(html, category) {
  const out = [];
  const table = /<table[\s\S]*?<\/table>/i.exec(String(html))?.[0] ?? '';
  for (const cell of table.split(/<td\b/).slice(1)) {
    const dm = /id="spandt\d+"[^>]*>\s*([A-Z][a-z]{2}) (\d{1,2}) (\d{4})\s*</.exec(cell);
    if (!dm) continue;
    const date = `${dm[3]}-${pad(MONTHS[dm[1]])}-${pad(dm[2])}`;
    let sheet = '';
    const re = /<div class="surfdiv[^"]*">\s*<strong>([^<]*)<\/strong>|<div class="sessdiv[^"]*">([\s\S]*?)<\/div>/g;
    let m;
    while ((m = re.exec(cell))) {
      if (m[1] != null) { sheet = sheetName(m[1]); continue; }
      const tm = /(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(m[2]);
      if (!tm) continue;
      const start = `${date}T${to24(tm[1], tm[2], tm[3])}`;
      const end = `${date}T${to24(tm[4], tm[5], tm[6])}`;
      out.push({
        rink: slug, rinkName: name, sheet: sheet || 'Rink', sourceId: `${category}|${sheet}|${start}`,
        start, end, title: '', subtitle: '', category, capacity: null, color, registerUrl: null,
      });
    }
  }
  return out;
}

function monthsBetween(from, to) {
  const out = [];
  let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const [ty, tm] = [Number(to.slice(0, 4)), Number(to.slice(5, 7))];
  while (y < ty || (y === ty && m <= tm)) { out.push([y, m]); m += 1; if (m > 12) { m = 1; y += 1; } }
  return out;
}

export async function fetchEvents({ from, to }) {
  try {
    const events = [];
    const seen = new Set();
    for (const [y, m] of monthsBetween(from, to)) {
      for (const [session, category] of Object.entries(SESSIONS)) {
        const res = await fetch(`${BASE}&session=${session}&month=${m}&year=${y}`, { headers: { 'user-agent': 'Mozilla/5.0 (nova-ice-schedules)', accept: 'text/html' } });
        if (!res.ok) throw new Error(`Frontline ${res.status} for session ${session} ${y}-${m}`);
        for (const e of normalize(await res.text(), category)) if (!seen.has(e.sourceId)) { seen.add(e.sourceId); events.push(e); }
      }
    }
    const lo = `${from}T00:00:00`;
    const hi = `${to}T23:59:59`;
    return events.filter((e) => e.start >= lo && e.start <= hi);
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, phone, website, registerUrl, onlinePay, color, sheets, fetchEvents, normalize };
