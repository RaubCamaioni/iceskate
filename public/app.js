// Merged rink schedule as a single list. Loads api/events (Node server) or data/schedule.json (static
// hosting), filters client-side, re-fetches every 5 minutes.

const CATEGORIES = [
  ['public_skate', 'Public skate', true], // the only type on by default; the user's choices are remembered after that
  ['freestyle', 'Freestyle', false],
  ['stick_and_puck', 'Stick & puck', false],
  ['pickup_hockey', 'Pick-up hockey', false],
  ['learn_to_skate', 'Lessons', false],
  ['hockey', 'Hockey games & practices', false],
  ['figure_skating', 'Figure skating programs', false],
  ['other', 'Other', false],
];
const REFRESH_MS = 5 * 60 * 1000;
// v3: rinks are stored as the ones switched OFF, so a rink added later shows up for returning visitors.
const STORAGE_KEY = 'nova-ice-filters-v3';
// Rinks publish some sessions (notably freestyle) as many back-to-back 30-minute slots.
// Consecutive slots of the same session on the same sheet are merged; a gap up to this many
// minutes (a resurface) still counts as consecutive.
const MERGE_GAP_MIN = 15;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, '0');
const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return todayISO(new Date(y, m - 1, d + n)); };
const parseLocal = (s) => { const [d, t = '00:00:00'] = s.split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi, se] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi, se || 0); };
const fmtSpan = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60), r = m % 60; return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`; };
const daysFromToday = (iso) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000); };
const minutesOf = (s) => { const t = s.slice(11, 16).split(':').map(Number); return t[0] * 60 + t[1]; };
const fmtTime = (s) => parseLocal(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
const fmtDay = (iso) => parseLocal(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const fmtDuration = (start, end) => {
  const m = Math.max(0, Math.round((parseLocal(end) - parseLocal(start)) / 60000));
  const h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`;
};
const catLabel = Object.fromEntries(CATEGORIES.map(([k, l]) => [k, l]));
// Shorter labels for the fixed-width type block on cards.
const catShort = { ...catLabel, hockey: 'Hockey', figure_skating: 'Figure skating' };
const catColor = (k) => getComputedStyle(document.documentElement).getPropertyValue(`--cat-${k}`).trim();
const mapsUrl = (r) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address ? `${r.name}, ${r.address}` : r.name)}`;

let state = { days: 14, offRinks: [], categories: null, hidePast: false };
let data = { rinks: [], events: [], errors: [] };
let rinkInfo = {};
let timer = null;

function loadState() {
  try { state = { ...state, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { /* ignore */ }
  if (![1, 7, 14, 30].includes(state.days)) state.days = 14;
  if (!Array.isArray(state.offRinks)) state.offRinks = [];
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function mergeAdjacent(events) {
  const key = (e) => `${e.rink}|${e.sheet}|${e.category}|${e.title}`;
  const out = [];
  const open = new Map();
  for (const e of [...events].sort((a, b) => a.start.localeCompare(b.start))) {
    const k = key(e);
    const prev = open.get(k);
    if (prev && prev.end.slice(0, 10) === e.start.slice(0, 10) && minutesOf(e.start) - minutesOf(prev.end) <= MERGE_GAP_MIN && e.start >= prev.start) {
      if (e.end > prev.end) prev.end = e.end;
      prev.slots += 1;
      if (e.capacity && (!prev.capacity || e.capacity < prev.capacity)) prev.capacity = e.capacity;
      continue;
    }
    const m = { ...e, slots: 1 };
    out.push(m);
    open.set(k, m);
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.rink.localeCompare(b.rink) || a.sheet.localeCompare(b.sheet));
}

// ---------------------------------------------------------------- filters
function chip(label, on, color, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip' + (on ? ' on' : '');
  b.textContent = label;
  b.setAttribute('aria-pressed', String(on));
  if (color) b.style.setProperty('--chip', color);
  b.addEventListener('click', onClick);
  return b;
}

function renderFilters() {
  renderRinkRows();
  const cf = $('#category-filters');
  cf.replaceChildren();
  if (!state.categories) state.categories = CATEGORIES.filter((c) => c[2]).map((c) => c[0]);
  for (const [key, label] of CATEGORIES) {
    cf.append(chip(label, state.categories.includes(key), catColor(key), () => {
      state.categories = state.categories.includes(key) ? state.categories.filter((k) => k !== key) : [...state.categories, key];
      saveState(); renderFilters(); renderList();
    }));
  }
  for (const b of $$('.range button')) b.classList.toggle('on', Number(b.dataset.days) === state.days);
  $('#hide-past').checked = state.hidePast;
}

function matches(e, now) {
  if (state.offRinks.includes(e.rink)) return false;
  if (!state.categories.includes(e.category)) return false;
  if (state.hidePast && parseLocal(e.end) < now) return false;
  return true;
}

// One row per rink in the Location card: a switch, the name, phone, address, and links.
function renderRinkRows() {
  $('#sources').replaceChildren(...data.rinks.map((r) => {
    const on = !state.offRinks.includes(r.slug);
    const li = document.createElement('li');
    li.style.setProperty('--rink', r.color || '');
    li.classList.toggle('off', !on);
    const sw = document.createElement('label'); sw.className = 'switch rl-switch';
    sw.innerHTML = `<input type="checkbox" role="switch" aria-label="Show ${escapeHtml(r.name)} sessions"><span class="track" aria-hidden="true"></span>`;
    const input = sw.querySelector('input');
    input.checked = on;
    input.addEventListener('change', () => {
      state.offRinks = input.checked ? state.offRinks.filter((s) => s !== r.slug) : [...new Set([...state.offRinks, r.slug])];
      saveState(); renderRinkRows(); renderList();
    });
    const name = document.createElement('span'); name.className = 'rl-name'; name.textContent = r.name;
    const info = document.createElement('span'); info.className = 'rl-info';
    if (r.phone) {
      const tel = document.createElement('a'); tel.href = `tel:${r.phone.replace(/[^\d+]/g, '')}`; tel.textContent = r.phone; tel.className = 'rl-phone';
      info.append(tel);
    }
    if (r.address) {
      // The address opens directions in Google Maps, like the rink block on each card.
      const ad = document.createElement('a'); ad.className = 'rl-addr'; ad.href = mapsUrl(r); ad.target = '_blank'; ad.rel = 'noopener';
      ad.title = `Directions to ${r.name}`; ad.textContent = r.address; info.append(ad);
    }
    const links = document.createElement('span'); links.className = 'rl-links';
    if (r.registerUrl) {
      const pay = document.createElement('a'); pay.href = r.registerUrl; pay.target = '_blank'; pay.rel = 'noopener'; pay.className = 'rl-web';
      pay.textContent = r.onlinePay ? 'Pre-pay online' : 'Walk-in prices';
      links.append(pay);
    }
    const web = document.createElement('a'); web.href = r.website; web.target = '_blank'; web.rel = 'noopener'; web.textContent = 'Website'; web.className = 'rl-web';
    links.append(web);
    li.append(sw, name, info, links);
    return li;
  }));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------- list
function fillCard(node, e, now) {
  const rink = rinkInfo[e.rink] || { name: e.rinkName, address: '', shortName: e.rinkName, color: '' };
  const start = parseLocal(e.start), end = parseLocal(e.end);
  node.style.setProperty('--cat', catColor(e.category));
  node.style.setProperty('--rink', rink.color || '');
  if (start <= now && now < end) node.classList.add('now');
  else if (end < now) node.classList.add('past');
  const link = $('.rink', node);
  link.href = mapsUrl(rink);
  link.title = `Directions to ${rink.name}${rink.address ? `, ${rink.address}` : ''}`;
  link.setAttribute('aria-label', link.title);
  $('.rink-text', node).textContent = rink.shortName || rink.name;
  $('.sheet', node).textContent = e.sheet;
  $('.cat', node).textContent = catShort[e.category] || e.category;
  $('.cat', node).title = catLabel[e.category] || e.category;
  $('.start', node).textContent = fmtTime(e.start);
  $('.end', node).textContent = fmtTime(e.end);
  $('.dur', node).textContent = fmtDuration(e.start, e.end);
  const dd = daysFromToday(e.start.slice(0, 10));
  let when;
  if (dd === 0) {
    // Today: count down to the start, then to the end.
    if (now < start) when = `Starts in ${fmtSpan(start - now)}`;
    else if (now < end) when = `Now · ends in ${fmtSpan(end - now)}`;
    else when = 'Ended';
  } else when = dd === 1 ? 'Tomorrow' : dd > 1 ? `In ${dd} days` : dd === -1 ? 'Yesterday' : `${-dd} days ago`;
  $('.days', node).textContent = when;
  const extra = [e.slots > 1 ? `${e.slots} back-to-back slots` : '', e.capacity ? `capacity ${e.capacity}${e.slots > 1 ? ' per slot' : ''}` : ''].filter(Boolean).join(', ');
  // The card's middle stays blank; the details live in the tooltip.
  node.title = [e.title, e.subtitle, extra].filter(Boolean).join('\n');
  return node;
}

function renderList() {
  const list = $('#list');
  const now = new Date();
  const tpl = $('#event-row');
  const todayStr = todayISO();
  // Within today, finished sessions sort above the "Now" line even if an ongoing session started earlier.
  const finished = (e) => (e.start.slice(0, 10) === todayStr && parseLocal(e.end) < now ? 0 : 1);
  const shown = data.events
    .filter((e) => matches(e, now))
    .sort((a, b) => a.start.slice(0, 10).localeCompare(b.start.slice(0, 10)) || finished(a) - finished(b) || a.start.localeCompare(b.start) || a.rink.localeCompare(b.rink));
  list.replaceChildren();
  for (const err of data.errors) {
    const p = document.createElement('p'); p.className = 'error';
    const who = rinkInfo[err.rink]?.name ?? err.rink;
    p.textContent = err.stale ? `${who}: the last sync failed (${err.message}); showing its previous data.` : `${who} could not be loaded (${err.message}); its sessions are missing.`;
    list.append(p);
  }
  if (!shown.length) {
    const p = document.createElement('p'); p.className = 'empty';
    p.textContent = data.events.length ? 'Nothing matches these filters.' : 'No sessions found for this range.';
    list.append(p);
    return;
  }
  const today = todayISO();
  let nowMarked = false;
  const nowMark = () => {
    const d = document.createElement('div'); d.className = 'nowmark';
    d.innerHTML = `<span>Now</span><span class="nowtime">${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}</span>`;
    nowMarked = true;
    return d;
  };
  let currentDay = null, dayCount = 0, countEl = null;
  for (const e of shown) {
    const day = e.start.slice(0, 10);
    if (day !== currentDay) {
      if (countEl) countEl.textContent = `${dayCount} session${dayCount === 1 ? '' : 's'}`;
      if (currentDay === today && !nowMarked) list.append(nowMark()); // all of today's sessions are finished
      currentDay = day; dayCount = 0;
      const h = document.createElement('div'); h.className = 'day';
      const h2 = document.createElement('h2'); h2.textContent = day === todayISO() ? `Today, ${fmtDay(day)}` : fmtDay(day);
      countEl = document.createElement('span'); countEl.className = 'count';
      h.append(h2, countEl); list.append(h);
    }
    dayCount += 1;
    if (day === today && !nowMarked && parseLocal(e.end) >= now) list.append(nowMark());
    list.append(fillCard(tpl.content.firstElementChild.cloneNode(true), e, now));
  }
  if (currentDay === today && !nowMarked) list.append(nowMark());
  if (countEl) countEl.textContent = `${dayCount} session${dayCount === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------- load
// Where the schedule comes from. Under the Node server, api/events answers live from its cache.
// On a static host (GitHub Pages) there is no API; the daily build leaves data/schedule.json
// instead, which holds the whole window and is filtered to the requested range here.
// URLs are relative so the site works from a sub-path like user.github.io/iceskate/.
async function fetchSchedule(from, to) {
  const api = await fetch(`api/events?from=${from}&to=${to}`).catch(() => null);
  if (api?.ok && (api.headers.get('content-type') || '').includes('json')) return api.json();
  const res = await fetch('data/schedule.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const snap = await res.json();
  const lo = `${from}T00:00:00`, hi = `${to}T23:59:59`;
  return { ...snap, from, to, events: snap.events.filter((e) => e.start >= lo && e.start <= hi) };
}

async function load() {
  const from = todayISO();
  const to = addDays(from, state.days - 1);
  $('#status').textContent = 'Loading…';
  try {
    data = await fetchSchedule(from, to);
    data.rawCount = data.events.length;
    data.events = mergeAdjacent(data.events);
    rinkInfo = Object.fromEntries(data.rinks.map((r) => [r.slug, r]));
    renderFilters();
    renderList();
    const asOf = new Date(data.fetchedAt || data.generatedAt);
    const t = asOf.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    let freshness;
    if (data.source === 'static') {
      const sameDay = todayISO(asOf) === from;
      freshness = ` Rink data as of ${sameDay ? '' : `${asOf.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} `}${t}; it is re-synced every morning.`;
    } else {
      const every = data.refreshMs ? ` Rinks are re-read every ${Math.round(data.refreshMs / 60000)} min.` : '';
      freshness = ` Rink data as of ${t}.${every}`;
    }
    const stale = data.errors.some((e) => e.stale) ? ' Some rink data is older than that because its last refresh failed.' : '';
    const merged = data.rawCount > data.events.length ? ` (${data.rawCount} slots merged into ${data.events.length})` : '';
    $('#status').textContent = `${data.events.length} sessions${merged}, ${from} to ${to}.${freshness}${stale}`;
  } catch (err) {
    $('#status').textContent = `Failed to load: ${err.message}`;
  }
  clearTimeout(timer);
  timer = setTimeout(load, REFRESH_MS);
}

function init() {
  loadState();
  for (const b of $$('.range button')) b.addEventListener('click', () => { state.days = Number(b.dataset.days); saveState(); load(); });
  $('#hide-past').addEventListener('change', (ev) => { state.hidePast = ev.target.checked; saveState(); renderList(); });
  setInterval(renderList, 60 * 1000); // keep "now" highlighting fresh
  load();
}

init();
