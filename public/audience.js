// Who a session is for, worked out from the rink's own title and description.
// Returns { text, restricted } or null. `restricted` means not everyone can
// skate (age or group rule), so the card shows an amber badge.
export function audience(e) {
  const t = `${e.title || ''} ${e.subtitle || ''}`.toLowerCase().replace(/\s+/g, ' ');
  if (!t.trim()) return null;
  // Age floors written as "18+", "(14+)", "18 and older", "must be 18".
  const plus = t.match(/\b(1[3-9]|2[01])\s*\+/) || t.match(/\b(1[3-9]|2[01]) (?:or|and) (?:older|over|up)\b/) || t.match(/must be (1[3-9]|2[01])/);
  if (plus) return { text: `${plus[1]}+ only`, restricted: true };
  if (/parent(?:s)? (?:and|&|\/) tot|mommy|daddy|tots? (?:and|&) parent/.test(t)) return { text: 'Parent & tot', restricted: true };
  if (/playground on ice/.test(t)) return { text: 'Little kids + adult', restricted: true };
  if (/\bsenior/.test(t)) return { text: 'Seniors', restricted: true };
  if (/\bwomen/.test(t)) return { text: 'Women', restricted: true };
  if (/high school/.test(t)) return { text: 'High school ages', restricted: true };
  // Age ranges and caps: "ages 9-14", "(Age 7-13)", "12U", "10 and under", "13 & under".
  const range = t.match(/\bages? ?(\d{1,2}) ?[-–] ?(\d{1,2})/);
  if (range) return { text: `Ages ${range[1]}–${range[2]}`, restricted: true };
  const cap = t.match(/\b(\d{1,2})u\b/) || t.match(/\b(\d{1,2}) (?:and|&) under\b/);
  if (cap) return { text: `Ages ${cap[1]} and under`, restricted: true };
  if (/adults welcome|all ages|family/.test(t)) return { text: 'All ages', restricted: false };
  if (/\badults? ?(?:only|swim|skate|session|ps\b|pick|hockey|ltp|learn|\d)/.test(t)) return { text: 'Adults only', restricted: true };
  if (/\b(?:youth|junior|jr\.?|kids?|mini|tot)\b/.test(t)) return { text: 'Youth only', restricted: true };
  return null;
}

// A short name for a session that goes by something other than its category,
// e.g. "Cheapskate" or "Disco Skate". Generic titles return null.
export function sessionLabel(e) {
  let s = (e.title || '').trim();
  if (!s) return null;
  s = s.replace(/^public\s*(skate)?\s*[-:–]?\s*/i, '').replace(/\s*\(.*\)\s*$/, '').trim();
  if (!s) return null;
  if (/^(weekday|weekend|morning|afternoon|evening|am|pm|skate)\b/i.test(s)) return null;
  const a = audience(e);
  if (a && new RegExp(`^${a.text.replace(/[+&]/g, '.')}`, 'i').test(s)) return null; // badge already says it
  if (/^(adults? ?only|adult swim|parent and tot|playground on ice)/i.test(s)) return null;
  return s.length > 28 ? s.slice(0, 27).trimEnd() + '…' : s;
}
