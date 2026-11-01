// Pick the rink's price for one session from its published price list
// (`prices` in the adapter: { category, label, price, note }). Shared by the
// browser (price tag on each card) and the tests.

const GENERIC = new Set(['public', 'skate', 'skating', 'session', 'sessions', 'the', 'a', 'and', 'ice']);
const BASE = { adult_skate: 'public_skate', family_skate: 'public_skate' };
const words = (s) => (s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const specific = (label) => words(label.replace(/\(.*?\)/g, ' ').split(',')[0]).filter((w) => !GENERIC.has(w));

export function priceFor(e, prices) {
  const cat = BASE[e.category] || e.category;
  const pool = (prices || []).filter((p) => p.category === cat);
  if (!pool.length) return null;
  const title = new Set(words(`${e.title || ''} ${e.subtitle || ''}`));
  // 1. A price named after this session ("Cheapskate", "Friday Chill Out", "Arlington Senior Skate").
  const named = pool.find((p) => { const t = specific(p.label); return t.length && t.every((w) => title.has(w)); });
  if (named) return named;
  // 2. Weekday or weekend pricing, by the session's date.
  const day = e.start ? new Date(`${e.start.slice(0, 10)}T12:00:00`).getDay() : -1;
  const weekend = day === 0 || day === 6;
  const byDay = pool.find((p) => /\b(weekend|holiday)\b/i.test(p.label) === weekend && /\b(weekday|weekend|holiday)\b/i.test(p.label));
  if (byDay) return byDay;
  // 3. The plain price for the category, not one of its specially named variants.
  const plain = pool.find((p) => !specific(p.label).length && !/\b(weekday|weekend|holiday)\b/i.test(p.label));
  if (plain) return plain;
  const anyDay = pool.find((p) => !/\b(weekday|weekend|holiday)\b/i.test(p.label));
  return anyDay || pool[0];
}

// Break a price entry into tiers for the expanded card: the base amount plus every
// "<who> $<amount>" pair in the note, and any remarks without an amount
// ("rental included", "goalies free").
//   { label: 'Public skate', price: '$15', note: 'child $8, senior $5; rental not included' }
//   -> rows [Standard $15, Child $8, Senior $5], remarks ['rental not included']
export function priceRows(p) {
  const rows = [];
  const remarks = [];
  for (const raw of (p.note || '').split(/[;,]/)) {
    const seg = raw.trim();
    if (!seg) continue;
    const amounts = [...seg.matchAll(/\$\d+(?:\.\d+)?/g)];
    if (!amounts.length) { remarks.push(cap(seg)); continue; }
    const parts = amounts.length > 1 ? seg.split(/\s+and\s+/) : [seg];
    for (const part of parts) {
      const m = part.match(/\$\d+(?:\.\d+)?/);
      if (!m) continue;
      const before = part.slice(0, m.index).replace(/\b(sessions?|admission)\b/gi, '').trim();
      const after = part.slice(m.index + m[0].length).replace(/\b(sessions?|admission|a session)\b/gi, '').trim();
      const label = [before, after].filter(Boolean).join(', ');
      rows.push({ label: cap(label || 'Other'), amount: m[0] });
    }
  }
  // The headline amount leads, unless it is a range the note has already broken down.
  const base = p.label.includes(',') ? p.label.split(',').slice(1).join(',').trim() : (specific(p.label).length ? p.label : 'Standard');
  if (!(rows.length && /\bto\b/.test(p.price))) rows.unshift({ label: cap(base), amount: p.price });
  return { rows, remarks };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
