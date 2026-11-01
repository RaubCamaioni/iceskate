// Merged rink schedule as a single list. Loads api/events (Node server) or data/schedule.json (static
// hosting), filters client-side, re-fetches every 5 minutes.

const CATEGORIES = [
  ['public_skate', 'Public skate', true], // on by default; the user's choices are remembered after that
  ['adult_skate', 'Adult skate', true], // public skates limited to adults or seniors
  ['family_skate', 'Kids & family skate', true], // parent & tot, playground on ice, homeschool, youth-only public skates
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
const catShort = { ...catLabel, family_skate: 'Kids & family', hockey: 'Hockey', figure_skating: 'Figure skating' };
import { audience, sessionLabel } from './audience.js';
const catColor = (k) => getComputedStyle(document.documentElement).getPropertyValue(`--cat-${k}`).trim();
const mapsUrl = (r) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address ? `${r.name}, ${r.address}` : r.name)}`;

// Drive times start from Leesburg until the visitor sets their own place.
const DEFAULT_ORIGIN = { label: 'Leesburg, VA', lat: 39.1157, lng: -77.5636, isDefault: true };
let state = { days: 14, offRinks: [], categories: null, hidePast: false, origin: DEFAULT_ORIGIN, showMap: false }; // origin: { label, lat, lng }
let data = { rinks: [], events: [], errors: [] };
let rinkInfo = {};
let travel = {}; // slug -> { min, mi, mode: 'drive' | 'line' } from the chosen starting point
let timer = null;

function loadState() {
  try { state = { ...state, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { /* ignore */ }
  // Visitors who saved their chips before the adult/family split get the new chips switched on once.
  if (state.categories && !state.sawSkateSplit) {
    for (const k of ['adult_skate', 'family_skate']) if (!state.categories.includes(k)) state.categories.push(k);
  }
  state.sawSkateSplit = true;
  if (![1, 7, 14, 30].includes(state.days)) state.days = 14;
  if (!Array.isArray(state.offRinks)) state.offRinks = [];
  if (!state.origin || state.origin.isDefault || !(Number.isFinite(state.origin.lat) && Number.isFinite(state.origin.lng))) state.origin = DEFAULT_ORIGIN;
  state.showMap = Boolean(state.showMap);
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

// ---------------------------------------------------------------- distance and drive times
const haversineMiles = (a, b) => {
  const R = 3958.8, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const fmtMin = (min) => fmtSpan(min * 60000);

// Driving times from the OSRM demo router (one request for every rink); straight-line distance if it fails.
async function computeTravel() {
  travel = {};
  const o = state.origin;
  if (!o) return;
  const rinks = data.rinks.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  for (const r of rinks) travel[r.slug] = { min: null, mi: Math.round(haversineMiles(o, r) * 10) / 10, mode: 'line' };
  try {
    const coords = [o, ...rinks].map((p) => `${p.lng},${p.lat}`).join(';');
    const res = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=duration,distance`);
    if (!res.ok) throw new Error(`router ${res.status}`);
    const j = await res.json();
    if (j.code !== 'Ok') throw new Error(j.code);
    rinks.forEach((r, i) => {
      const sec = j.durations?.[0]?.[i + 1], m = j.distances?.[0]?.[i + 1];
      if (sec != null) travel[r.slug] = { min: Math.round(sec / 60), mi: Math.round((m / 1609.344) * 10) / 10, mode: 'drive' };
    });
  } catch (err) {
    console.warn('drive times unavailable, using straight-line distance:', err.message);
  }
}

function sortedRinks() {
  if (!state.origin) return data.rinks;
  const key = (r) => { const t = travel[r.slug]; return t ? (t.min ?? t.mi * 2) : Infinity; }; // ~30 mph when only distance is known
  return [...data.rinks].sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name));
}

async function setOrigin(origin) {
  state.origin = origin ?? DEFAULT_ORIGIN;
  saveState();
  renderOriginStatus('Working out drive times…');
  await computeTravel();
  renderOriginStatus();
  renderRinkRows();
  renderList();
}

function renderOriginStatus(text) {
  const el = $('#origin-status');
  el.replaceChildren();
  if (text) { el.textContent = text; return; }
  if (!state.origin) return;
  const modes = new Set(Object.values(travel).map((t) => t.mode));
  const from = state.origin.isDefault ? `${state.origin.label} (the default; set your own above)` : state.origin.label;
  el.append(modes.has('drive') ? `Drive times from ${from}, closest first.` : `Straight-line distance from ${from} (routing unavailable).`);
  if (!state.origin.isDefault) {
    const clear = document.createElement('a'); clear.href = '#'; clear.className = 'clear'; clear.textContent = 'Reset to Leesburg';
    clear.addEventListener('click', (ev) => { ev.preventDefault(); setOrigin(DEFAULT_ORIGIN); });
    el.append(clear);
  }
}

async function geocode(q) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const hit = (await res.json())[0];
  if (!hit) throw new Error('not found');
  const label = hit.display_name.split(',').slice(0, 2).join(',').trim();
  return { label: label || q, lat: Number(hit.lat), lng: Number(hit.lon) };
}

function useMyLocation() {
  if (!navigator.geolocation) { renderOriginStatus('This browser cannot share its location; type one instead.'); return; }
  renderOriginStatus('Asking for your location…');
  navigator.geolocation.getCurrentPosition(
    (pos) => setOrigin({ label: 'my location', lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => renderOriginStatus(`Location not shared (${err.message}). Type one instead.`),
    { maximumAge: 5 * 60 * 1000, timeout: 15000 },
  );
}

// ---------------------------------------------------------------- map of rinks
let map = null;
let markers = new Map(); // slug -> circleMarker
let originMarker = null;

function toggleRink(slug) {
  state.offRinks = state.offRinks.includes(slug) ? state.offRinks.filter((s) => s !== slug) : [...state.offRinks, slug];
  saveState(); renderRinkRows(); renderList();
}

function popupHtml(r) {
  const off = state.offRinks.includes(r.slug);
  const t = travel[r.slug];
  const drive = t ? `<div class="pop-drive">${t.mode === 'drive' ? `${fmtMin(t.min)} drive · ${t.mi} mi` : `${t.mi} mi away`}</div>` : '';
  const addr = r.address ? `<div class="pop-row"><a href="${mapsUrl(r)}" target="_blank" rel="noopener" title="Directions">${escapeHtml(r.address)}</a></div>` : '';
  const phone = r.phone ? `<div class="pop-row"><a href="tel:${r.phone.replace(/[^\d+]/g, '')}">${escapeHtml(r.phone)}</a></div>` : '';
  const prices = (r.prices ?? []).length ? `<div class="pop-prices">${r.prices.map((p) => `<span title="${escapeHtml(p.note ?? '')}">${escapeHtml(p.label)} <b>${escapeHtml(p.price)}</b></span>`).join('')}</div>` : '';
  return `<div class="pop-name">${escapeHtml(r.name)}</div>${drive}${addr}${phone}${prices}
    <div class="pop-links"><a href="${r.website}" target="_blank" rel="noopener">Website</a>
    <button type="button" class="chip${off ? '' : ' on'}" data-toggle="${r.slug}">${off ? 'Show sessions' : 'Showing sessions'}</button></div>`;
}

function renderMap() {
  const el = $('#map');
  const btn = $('#toggle-map');
  btn.textContent = state.showMap ? 'Hide map' : 'Show map';
  btn.classList.toggle('on', state.showMap);
  btn.setAttribute('aria-pressed', String(state.showMap));
  if (!state.showMap) { el.hidden = true; return; }
  el.hidden = false;
  if (typeof L === 'undefined') { el.textContent = 'The map library could not be loaded.'; return; }
  if (!map) {
    map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    map.on('popupopen', (ev) => {
      const b = ev.popup.getElement()?.querySelector('[data-toggle]');
      if (b) b.addEventListener('click', () => { toggleRink(b.dataset.toggle); ev.popup.setContent(popupHtml(rinkInfo[b.dataset.toggle])); });
    });
  }
  const pts = [];
  for (const r of data.rinks) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const off = state.offRinks.includes(r.slug);
    const style = { radius: 10, color: '#fff', weight: 2, fillColor: r.color || '#888', fillOpacity: off ? 0.3 : 0.95, opacity: off ? 0.4 : 1 };
    let m = markers.get(r.slug);
    if (!m) {
      m = L.circleMarker([r.lat, r.lng], style).addTo(map);
      m.bindTooltip(r.shortName || r.name, { direction: 'top', offset: [0, -8] });
      m.bindPopup(() => popupHtml(r), { maxWidth: 280 });
      markers.set(r.slug, m);
    } else m.setStyle(style);
    pts.push([r.lat, r.lng]);
  }
  if (state.origin) {
    const o = [state.origin.lat, state.origin.lng];
    if (!originMarker) { originMarker = L.circleMarker(o, { radius: 7, color: '#fff', weight: 2, fillColor: '#e53935', fillOpacity: 1 }).addTo(map); originMarker.bindTooltip(() => `Start: ${state.origin.label}`, { direction: 'top', offset: [0, -6] }); }
    else originMarker.setLatLng(o);
    pts.push(o);
  } else if (originMarker) { originMarker.remove(); originMarker = null; }
  map.invalidateSize();
  if (pts.length && !map._fitted) { map.fitBounds(pts, { padding: [28, 28] }); map._fitted = true; }
  else if (state.origin && !map._fittedOrigin) { map.fitBounds(pts, { padding: [28, 28] }); map._fittedOrigin = true; }
}

// One row per rink in the Location card: a switch, the name, drive time, phone, address, and links.
function renderRinkRows() {
  renderMap();
  $('#sources').replaceChildren(...sortedRinks().map((r) => {
    const on = !state.offRinks.includes(r.slug);
    const li = document.createElement('li');
    li.style.setProperty('--rink', r.color || '');
    li.classList.toggle('off', !on);
    const sw = document.createElement('label'); sw.className = 'switch rl-switch';
    sw.innerHTML = `<input type="checkbox" role="switch" aria-label="Show ${escapeHtml(r.name)} sessions"><span class="track" aria-hidden="true"></span>`;
    const input = sw.querySelector('input');
    input.checked = on;
    input.addEventListener('change', () => toggleRink(r.slug));
    const name = document.createElement('span'); name.className = 'rl-name'; name.textContent = r.name;
    const info = document.createElement('span'); info.className = 'rl-info';
    const t = travel[r.slug];
    if (t) {
      const dv = document.createElement('span'); dv.className = 'rl-drive';
      dv.textContent = t.mode === 'drive' ? `${fmtMin(t.min)} drive · ${t.mi} mi` : `${t.mi} mi away`;
      dv.title = `${t.mode === 'drive' ? 'Driving time' : 'Straight-line distance'} from ${state.origin.label}`;
      info.append(dv);
    }
    if (r.phone) {
      const tel = document.createElement('a'); tel.href = `tel:${r.phone.replace(/[^\d+]/g, '')}`; tel.textContent = r.phone; tel.className = 'rl-phone';
      info.append(tel);
    }
    if (r.address) {
      // The address opens directions in Google Maps, like the rink block on each card.
      const ad = document.createElement('a'); ad.className = 'rl-addr'; ad.href = mapsUrl(r); ad.target = '_blank'; ad.rel = 'noopener';
      ad.title = `Directions to ${r.name}`; ad.textContent = r.address; info.append(ad);
    }
    // Per-session prices on a second line of the row.
    const prices = document.createElement('span'); prices.className = 'rl-prices';
    for (const p of r.prices ?? []) {
      const it = document.createElement('span'); it.className = 'price';
      it.innerHTML = `${escapeHtml(p.label)} <b>${escapeHtml(p.price)}</b>`;
      if (p.note) it.title = p.note;
      prices.append(it);
    }
    // One plain hyperlink to the rink's own website.
    const links = document.createElement('span'); links.className = 'rl-links';
    const web = document.createElement('a'); web.href = r.website; web.target = '_blank'; web.rel = 'noopener'; web.textContent = 'Website'; web.className = 'rl-link';
    links.append(web);
    li.append(sw, name, info, links);
    if (prices.childElementCount) li.append(prices);
    return li;
  }));
}

// Popover under a card's "Restrictions apply" / "All ages" tag: the parsed rule, the
// session's name and the rink's own description, plus a link to the rink.
function toggleWhoPop(anchor, e, who, rink) {
  const pop = $('#who-pop');
  const key = `${e.rink}|${e.start}|${e.sheet}`;
  if (!pop.hidden && pop.dataset.for === key) { hideWhoPop(); return; }
  pop.dataset.for = key;
  const rule = who.restricted ? `Only for: ${who.text}` : 'Anyone may skate';
  const desc = e.subtitle ? escapeHtml(e.subtitle) : '<span class="muted">The rink gave no further description. Check its website before you go.</span>';
  pop.innerHTML = `<div class="wp-head"><b>${who.restricted ? 'Restrictions apply' : 'Open to all ages'}</b><button type="button" class="wp-close" aria-label="Close">×</button></div>
    <p class="wp-rule">${escapeHtml(rule)}</p>
    <p class="wp-session">${escapeHtml(rink.name)} · ${escapeHtml(catLabel[e.category] || e.category)}${e.title ? ` · ${escapeHtml(e.title)}` : ''}</p>
    <p class="wp-desc">${desc}</p>
    ${rink.website ? `<a class="wp-link" href="${escapeHtml(rink.website)}" target="_blank" rel="noopener">Rink website</a>` : ''}`;
  $('.wp-close', pop).addEventListener('click', hideWhoPop);
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const width = Math.min(360, document.documentElement.clientWidth - 24);
  pop.style.width = `${width}px`;
  pop.style.top = `${r.bottom + 6 + window.scrollY}px`;
  pop.style.left = `${Math.max(12, Math.min(r.left, document.documentElement.clientWidth - width - 12)) + window.scrollX}px`;
}
function hideWhoPop() { const pop = $('#who-pop'); pop.hidden = true; pop.dataset.for = ''; }

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
  // Drive time from the chosen starting point, in the card's middle.
  const t = travel[e.rink];
  const drive = $('.drive', node);
  if (t) {
    drive.hidden = false;
    drive.textContent = t.mode === 'drive' ? `${fmtMin(t.min)} drive` : `${t.mi} mi away`;
    drive.title = `${t.mode === 'drive' ? `${fmtMin(t.min)} drive, ${t.mi} mi` : `${t.mi} mi straight line`} from ${state.origin.label}`;
  }
  // Who the session is for (amber when not everyone can skate) and any special name.
  // A general tag after the drive time; tapping it opens the rule and the rink's own wording.
  const who = audience(e), whoEl = $('.who', node);
  whoEl.hidden = !who;
  if (who) {
    whoEl.textContent = who.restricted ? 'Restrictions apply' : 'All ages';
    whoEl.classList.toggle('open', !who.restricted);
    whoEl.title = who.restricted ? `${who.text}. Tap for details.` : 'Open to all ages. Tap for details.';
    whoEl.addEventListener('click', (ev) => { ev.stopPropagation(); toggleWhoPop(whoEl, e, who, rink); });
  }
  const label = sessionLabel(e), labelEl = $('.label', node);
  labelEl.hidden = !label;
  if (label) { labelEl.textContent = label; labelEl.title = e.title; }
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
  hideWhoPop();
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
    if (state.origin && !Object.keys(travel).length) { await computeTravel(); renderOriginStatus(); }
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
  // The restrictions popover closes on an outside tap, Escape, or when the list re-renders.
  document.addEventListener('click', (ev) => { const pop = $('#who-pop'); if (!pop.hidden && !pop.contains(ev.target)) hideWhoPop(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hideWhoPop(); });
  for (const b of $$('.range button')) b.addEventListener('click', () => { state.days = Number(b.dataset.days); saveState(); load(); });
  $('#hide-past').addEventListener('change', (ev) => { state.hidePast = ev.target.checked; saveState(); renderList(); });
  $('#use-location').addEventListener('click', useMyLocation);
  $('#toggle-map').addEventListener('click', () => { state.showMap = !state.showMap; saveState(); renderMap(); });
  $('#origin-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const q = $('#origin-input').value.trim();
    if (!q) return;
    renderOriginStatus(`Looking up "${q}"…`);
    try { await setOrigin(await geocode(q)); } catch (err) { renderOriginStatus(`Could not find "${q}" (${err.message}).`); }
  });
  setInterval(renderList, 60 * 1000); // keep "now" highlighting fresh
  load();
}

init();
