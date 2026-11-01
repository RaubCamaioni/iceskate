// Shared client for DaySmart Recreation ("DASH") rinks: Ashburn, Haymarket, SkateQuest, ...
// JSON:API at apps.daysmartrecreation.com; each rink is a `company` slug. See rinks/ashburn-ice-house/README.md
// for the endpoint research. Only `summary` and `resource` are ever included: customer and registration
// includes carry personal data and are never requested.

export const BASE = 'https://apps.daysmartrecreation.com/dash/jsonapi/api/v1';
export const portalUrl = (company, page) => `https://apps.daysmartrecreation.com/dash/x/#/online/${company}/${page}`;

export function stripHtml(s) {
  if (s == null || typeof s === 'object') s = '';
  return String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export function truncate(s, max = 140) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[,;:.\s]+$/, '')}…`;
}

// Walk one JSON:API page, joining each event to its included summary and resource.
export function* rows(page) {
  const included = new Map();
  for (const i of page.included ?? []) included.set(`${i.type}:${i.id}`, i.attributes ?? {});
  for (const e of page.data ?? []) {
    const a = e.attributes ?? {};
    const summary = included.get(`event-summaries:${e.id}`) ?? {};
    const resource = included.get(`resources:${a.resource_id}`) ?? {};
    const leagueId = e.relationships?.league?.data?.id ?? a.league_id;
    const league = leagueId != null ? included.get(`leagues:${leagueId}`) ?? {} : {};
    yield { id: String(e.id), a, summary, resource, league, typeId: String(a.event_type_id ?? ''), typeName: summary.event_type ?? '' };
  }
}

// Fetch every page of events for [from, to] (YYYY-MM-DD, local). Returns the raw pages.
// `include` may add `league` (needed where drop-ins are classified by their league's sport); never customer data.
export async function fetchPages({ company, from, to, resources, eventTypes, include = 'summary,resource', publishOnly = true, pageSize = 500, maxPages = 10 }) {
  const pages = [];
  let n = 1;
  let last = 1;
  do {
    const qs = new URLSearchParams({
      company,
      'filter[start__gte]': `${from}T00:00:00`,
      'filter[start__lte]': `${to}T23:59:59`,
      include,
      sort: 'start',
      'page[size]': String(pageSize),
      'page[number]': String(n),
    });
    if (resources?.length) qs.set('filter[resource_id__in]', resources.join(','));
    if (eventTypes?.length) qs.set('filter[event_type_id__in]', eventTypes.join(','));
    if (publishOnly) qs.set('filter[publish]', '1');
    const res = await fetch(`${BASE}/events?${qs}`, { headers: { accept: 'application/vnd.api+json' } });
    if (!res.ok) throw new Error(`DaySmart ${company} ${res.status} ${res.statusText}`);
    const page = await res.json();
    pages.push(page);
    last = page.meta?.page?.['last-page'] ?? 1;
    n += 1;
  } while (n <= last && n <= maxPages);
  return pages;
}

// Drop-in titles that only repeat the category ("Public Skate", "Freestyle", "Stick n Shoot") are blanked
// so the card does not say the same thing twice. Themed titles ("Halloween Skate") are kept.
const PLAIN_TITLE = /^(public (group )?skat(e|ing)( session)?|free ?style( session)?|(high|low) freestyle|stick[ -]?(n|and|&)[ -]?(shoot|puck)|(adult )?pick[ -]?up hockey)$/i;
export const plainTitle = (title, category) => (['public_skate', 'freestyle', 'stick_and_puck', 'pickup_hockey'].includes(category) && PLAIN_TITLE.test(title.trim()) ? '' : title.trim());
