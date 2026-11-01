// Who a session is for, worked out from the rink's own title and description.
// Shared by the browser (badges on cards) and the server/build (splitting
// restricted public skates into their own categories).
//
// audience(e) returns { text, restricted } or null. `restricted` means not
// everyone can skate (age or group rule), so the card shows an amber badge; an
// open session the rink labels as such shows a green "All ages" badge.
export function audience(e) {
  return fromText(e) || defaultFor(e);
}

// Stick-and-puck sessions are open to everyone unless the rink says otherwise.
// Public skate needs no badge: after refineCategory() that category only holds
// sessions anyone may join. Pick-up hockey, freestyle and classes have rules
// the feeds rarely state (age, full gear, skill level), so they only get a badge
// when the rink spells it out.
const OPEN_BY_DEFAULT = new Set(['stick_and_puck']);
function defaultFor(e) {
  return OPEN_BY_DEFAULT.has(e.category) ? { text: 'All ages', restricted: false } : null;
}

function fromText(e) {
  const t = `${e.title || ''} ${e.subtitle || ''}`.toLowerCase().replace(/\s+/g, ' ');
  if (!t.trim()) return null;
  // Age floors written as "18+", "(14+)", "18 and older", "must be 18".
  const plus = t.match(/\b(1[3-9]|2[01])\s*\+/) || t.match(/\b(1[3-9]|2[01]) (?:or|and) (?:older|over|up)\b/) || t.match(/must be (1[3-9]|2[01])/);
  if (plus) return { text: `${plus[1]}+ only`, restricted: true };
  if (/parent(?:s)? (?:and|&|\/) tot|mommy|daddy|tots? (?:and|&) parent/.test(t)) return { text: 'Parent & tot', restricted: true };
  if (/playground on ice/.test(t)) return { text: 'Little kids + adult', restricted: true };
  if (/home ?school/.test(t)) return { text: 'Homeschool families', restricted: true };
  if (/\bsenior/.test(t)) return { text: 'Seniors', restricted: true };
  if (/\bwomen/.test(t)) return { text: 'Women', restricted: true };
  if (/high school/.test(t)) return { text: 'High school ages', restricted: true };
  // Age ranges and caps: "ages 9-14", "(Age 7-13)", "12U", "10 and under", "13 & under".
  const range = t.match(/\bages? ?(\d{1,2}) ?[-–] ?(\d{1,2})/) || t.match(/\b(\d{1,2}) ?[-–] ?(\d{1,2})[- ]year[- ]olds?/);
  if (range) return { text: `Ages ${range[1]}–${range[2]}`, restricted: true };
  const cap = t.match(/\b(\d{1,2})u\b/) || t.match(/\b(\d{1,2}) (?:and|&) under\b/);
  if (cap) return { text: `Ages ${cap[1]} and under`, restricted: true };
  const under = t.match(/\b(?:kids|children|ages?) under (\d{1,2})\b/);
  if (under) return { text: `Under ${under[1]} only`, restricted: true };
  if (/adults welcome|all ages|family/.test(t)) return { text: 'All ages', restricted: false };
  if (/\badults? ?(?:only|swim|skate|session|ps\b|pick|hockey|ltp|learn|\d)/.test(t)) return { text: 'Adults only', restricted: true };
  if (/\b(?:youth|junior|jr\.?|kids?|mini|tot)\b/.test(t)) return { text: 'Youth only', restricted: true };
  return null;
}

// "Public skate" means anyone can turn up. A public skate the rink limits to
// adults or seniors becomes adult_skate; one for small children, parents with
// tots, youth or homeschool families becomes family_skate. Other categories
// pass through unchanged. Applied once, server side, to every adapter's events.
export function refineCategory(e) {
  if (e.category !== 'public_skate') return e.category;
  const a = fromText(e);
  if (!a || !a.restricted) return 'public_skate';
  if (/^\d+\+ only$|^Adults only$|^Seniors$/.test(a.text)) return 'adult_skate';
  if (/^Parent|^Little kids|^Homeschool|^Ages |^Under |^Youth|^High school/.test(a.text)) return 'family_skate';
  return 'public_skate';
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
  if (/^(adults? ?only|adult swim|adult skate|parent and tot|playground on ice|homeschooling ice session)/i.test(s)) return null;
  return s.length > 28 ? s.slice(0, 27).trimEnd() + '…' : s;
}
