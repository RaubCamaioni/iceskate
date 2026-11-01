// Ashburn Ice House — DaySmart Recreation ("DASH") JSON:API adapter.
// See README.md in this folder for the endpoint research. Shared client: lib/daysmart.js.

import { fetchPages, stripHtml, truncate } from '../../lib/daysmart.js';

export { truncate };

const COMPANY = 'ashburn';
const ICE_RESOURCES = [1, 2, 8]; // East Rink, West Rink, Outdoor Rink

export const slug = 'ashburn-ice-house';
export const name = 'Ashburn Ice House';
export const shortName = 'Ashburn';
export const address = '21595 Smith Switch Rd, Ashburn, VA 20147';
export const lat = 39.0190958; // geocoded 2026-10-31; used for distance sorting and drive times
export const lng = -77.4671305;
export const phone = '(703) 858-0300';
export const website = 'https://www.ashburnice.com/publicskating';
// Online pre-pay: the DaySmart event-registration page (all drop-in sessions live there; it has no per-event deep link).
export const registerUrl = 'https://apps.daysmartrecreation.com/dash/x/#/online/ashburn/event-registration';
export const onlinePay = true; // registerUrl is an online checkout, not just price info
export const color = '#1d6fb8';
export const sheets = ['East Rink', 'West Rink', 'Outdoor Rink'];

// Event types that are internal scheduling noise, never shown.
const HIDDEN_TYPES = new Set(['Block', 'Locker Room', 'Rental']);
const HOCKEY_TYPES = new Set([
  'Game', 'Team Practice', 'Xtreme Game', 'Xtreme Practice', 'Xtreme Contract', 'Edge Home Game',
  'Away Game-Select & Edge', 'NVSHL', 'NVSHL Game', 'HS Teams', 'HS Game Admissions', 'Old Timers',
  'Cold Rush', 'My Hockey', 'My Hockey Games', 'Selects', 'Tryout', 'AIH Internal', 'Youth Pick Up Hockey',
  'Power and Puck', 'Power Ice', 'Spirit Night', 'EDGE Travel Workout',
]);
const FIGURE_TYPES = new Set(['Theater on Ice', 'WFSC', 'Team Ashburn', 'Ice Show Tickets', 'Ice Show Tickets On Ice', 'Lessons By Troy']);

export function classify(summaryName, eventTypeName) {
  const n = (summaryName || '').toLowerCase();
  const t = eventTypeName || '';
  if (/playground on ice/.test(n)) return 'public_skate';
  if (/\bpublic\b|rockin/.test(n) || t === 'Public Skate' || t === 'Public Group Skate') return 'public_skate';
  // Drop-in classes and ice-show rehearsals mention "Freeskate" levels but are not open freestyle ice.
  if (/ice show|ensemble|synchro|theater/.test(n)) return 'figure_skating';
  if (/drop-? ?in|fast track|adaptive|through freeskate|pre-?freeskate/.test(n)) return 'learn_to_skate';
  if (/^freestyle\b|freestyle session|open freestyle/.test(n) || t === 'Freestyle') return 'freestyle';
  if (/stick\s*n\s*shoot|stick-n-shoot|stick and shoot|stick & puck/.test(n) || t === 'Stick-N-Shoot') return 'stick_and_puck';
  if (/pick\s*-?\s*up/.test(n) || t === 'Adult Pick-up Hockey') return 'pickup_hockey';
  if (t === 'Class' || t === 'Camp' || t === 'LTS Private Lesson Ice' || t === 'ACE') {
    if (/snowplow|basic \d|adult \d|pre-?freeskate|learn to|fast track|adaptive|jr\.? hockey|mommy|learn to play|ltp|drop-? ?in/.test(n)) return 'learn_to_skate';
    if (/ice show|ensemble|synchro|theater/.test(n)) return 'figure_skating';
    if (t === 'Class') return 'learn_to_skate';
  }
  if (HOCKEY_TYPES.has(t)) return 'hockey';
  if (FIGURE_TYPES.has(t)) return 'figure_skating';
  if (/\bvs\.?\b/.test(n)) return 'hockey';
  return 'other';
}

// Pure: JSON:API page -> normalised events. Exported for tests.
export function normalize(page) {
  const included = new Map();
  for (const i of page.included ?? []) included.set(`${i.type}:${i.id}`, i.attributes);
  const out = [];
  for (const e of page.data ?? []) {
    const a = e.attributes;
    if (!a.publish) continue;
    const summary = included.get(`event-summaries:${e.id}`) ?? {};
    const resource = included.get(`resources:${a.resource_id}`) ?? {};
    const typeName = summary.event_type ?? '';
    if (HIDDEN_TYPES.has(typeName)) continue;
    const title = (summary.name || a.desc || typeName || 'Ice time').trim();
    const category = classify(title, typeName);
    const blurb = stripHtml(a.best_description);
    out.push({
      rink: slug,
      rinkName: name,
      sheet: (resource.name || `Resource ${a.resource_id}`).trim(),
      sourceId: String(e.id),
      start: a.start,
      end: a.end,
      title,
      // Drop-in and class rows get their public blurb; hockey rows get the vendor type (e.g. "Xtreme Game").
      subtitle: typeName === 'Camp' || typeName === 'Class' ? truncate(blurb) : (typeName || ''),
      category,
      capacity: a.register_capacity > 0 ? a.register_capacity : null,
      color: summary.color ?? null,
      registerUrl: a.register_capacity > 0 ? registerUrl : null,
    });
  }
  return out;
}

export async function fetchEvents({ from, to }) {
  try {
    const pages = await fetchPages({ company: COMPANY, from, to, resources: ICE_RESOURCES });
    return pages.flatMap(normalize);
  } catch (err) {
    err.adapterSlug = slug;
    throw err;
  }
}

export default { slug, name, shortName, address, lat, lng, phone, website, registerUrl, onlinePay, color, sheets, fetchEvents, normalize, classify };
