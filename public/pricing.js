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
