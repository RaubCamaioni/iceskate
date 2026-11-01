// Mount Vernon RECenter Ice Arena (Fairfax County Park Authority) adapter.
// No API exists. Two public sources, see README.md:
//  1. The county's PDF month calendars (public, freestyle, hockey = PUH + SNP, ice dance): complete,
//     with the sheet (Red/Blue Rink). Parsed by pdf.js. Primary.
//  2. The county's US eDirect ("Parktakes") ticket store: server-rendered HTML, only ticketed
//     sessions, no sheet; it adds the sign-up link and seat count to matching sessions. It also
//     blocks some networks (GitHub's runners get 403), so it is optional; if the PDFs fail it is
//     the fallback.

import { parseCalendarPdf } from './pdf.js';

export const slug = 'mount-vernon-recenter';
export const name = 'Mount Vernon RECenter';
export const shortName = 'Mt Vernon';
export const address = '2017 Belle View Blvd, Alexandria, VA 22307';
export const lat = 38.7742696; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.0633647;
export const phone = '(703) 768-3224';
export const website = 'https://www.fairfaxcounty.gov/parks/recenter/mount-vernon/ice-arena';
export const SEARCH_URL = 'https://fairfax.usedirect.com/FairfaxFCPAWeb/ACTIVITIES/Search.aspx?category_name=ICE%20TICKETS&place_id=7949';
export const registerUrl = SEARCH_URL; // public, stick-and-puck and pickup sessions are sold online here
export const onlinePay = true;
export const color = '#6a1b9a';
export const sheets = ['Red Rink', 'Blue Rink'];

const PDF_BASE = 'https://www.fairfaxcounty.gov/parks/sites/parks/files/Assets/documents/recenters/calendars/';
// calendar file -> how its sessions are categorised (the hockey file is split by its PUH/SNP labels)
export const CALENDARS = {
  'mvice.pdf': 'public_skate',
  'mvfreestyle.pdf': 'freestyle',
  'mvice-hockey.pdf': 'hockey',
  'mvice-dance.pdf': 'figure_skating',
};
const SEARCHES = ['public', 'stick and puck', 'pickup hockey'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const pad = (n) => String(n).padStart(2, '0');

// Session codes in the ticket listing: PS / Adult PS = public skate, SNP = stick and puck, PUH = pickup hockey.
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

// Pure: parsed PDF sessions of one calendar file -> normalised events.
export function fromCalendar(sessions, file) {
  const base = CALENDARS[file];
  const out = [];
  for (const s of sessions) {
    let category = base;
    let title = '';
    if (base === 'hockey') {
      if (s.label === 'PUH') category = 'pickup_hockey';
      else if (s.label === 'SNP') category = 'stick_and_puck';
      else continue; // a time outside both blocks: not expected
    } else if (base === 'figure_skating') title = 'Ice Dance';
    if (s.adultOnly) title = 'Adults only (14+)';
    const start = `${s.date}T${s.start}`;
    out.push({
      rink: slug, rinkName: name, sheet: s.sheet, sourceId: `${category}|${start}`,
      start, end: `${s.date}T${s.end}`, title, subtitle: '', category, capacity: null, color, registerUrl: null,
    });
  }
  return out;
}

function to24(h, m, ap) {
  let hh = Number(h) % 12;
  if (/pm/i.test(ap)) hh += 12;
  return `${pad(hh)}:${m}:00`;
}
const cell = (row, label) => {
  const m = new RegExp(`data-label="${label}"[^>]*>([\\s\\S]*?)</td>`, 'i').exec(row);
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '';
};

// Pure: the ticket-store search page HTML -> normalised events (no sheet; carries sign-up link and seats).
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
      rink: slug, rinkName: name, sheet: 'Ice Arena', sourceId: String(id),
      start: `${date}T${to24(m[4], m[5], m[6])}`, end: `${date}T${to24(m[7], m[8], m[9])}`,
      title, subtitle: restrictions && !/^none$/i.test(restrictions) ? `Ages ${restrictions}` : '',
      category, capacity: seats, color,
      registerUrl: /session_id=\d+/.test(row) ? `https://fairfax.usedirect.com/FairfaxFCPAWeb/ACTIVITIES/Details.aspx?session_id=${id}` : registerUrl,
    });
  }
  return out;
}

// Pure: copy sign-up link, seats and age note from ticket-store rows onto the matching PDF sessions.
export function enrich(pdfEvents, ticketEvents) {
  const byKey = new Map(ticketEvents.map((t) => [`${t.category}|${t.start}`, t]));
  return pdfEvents.map((e) => {
    const t = byKey.get(`${e.category}|${e.start}`);
    return t ? { ...e, capacity: t.capacity, registerUrl: t.registerUrl, subtitle: t.subtitle || e.subtitle, title: e.title || t.title } : e;
  });
}

const headers = { 'user-agent': UA, accept: 'application/pdf,text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' };

async function fetchCalendars() {
  const events = [];
  for (const file of Object.keys(CALENDARS)) {
    const res = await fetch(PDF_BASE + file, { headers });
    if (!res.ok) throw new Error(`calendar ${file} ${res.status}`);
    events.push(...fromCalendar(await parseCalendarPdf(await res.arrayBuffer()), file));
  }
  if (!events.length) throw new Error('calendars parsed to nothing');
  return events;
}

async function fetchTickets() {
  const events = [];
  for (const q of SEARCHES) {
    const res = await fetch(`${SEARCH_URL}&search_text=${encodeURIComponent(q)}`, { headers });
    if (!res.ok) throw new Error(`usedirect ${res.status} for "${q}"`);
    events.push(...normalize(await res.text()));
  }
  return [...new Map(events.map((e) => [e.sourceId, e])).values()];
}

export async function fetchEvents({ from, to }) {
  const lo = `${from}T00:00:00`;
  const hi = `${to}T23:59:59`;
  let events;
  try {
    events = await fetchCalendars();
    try {
      events = enrich(events, await fetchTickets());
    } catch (err) {
      console.warn(`[${slug}] ticket store unavailable (${err.message}); sessions have no sign-up links`);
    }
  } catch (err) {
    console.warn(`[${slug}] calendars unavailable (${err.message}); falling back to the ticket store`);
    try {
      events = await fetchTickets();
    } catch (err2) {
      err2.adapterSlug = slug;
      throw err2;
    }
  }
  return events.filter((e) => e.start >= lo && e.start <= hi);
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, fetchEvents, normalize, classify };
