// Parser for Fairfax County's Mount Vernon ice calendars (PDF month grids).
//
// pdfjs gives every text fragment with page coordinates. Fragments on one baseline are merged into
// runs ("10:45-12:00 pm (B)"); the day numbers are right-aligned in their cells, so a week with all
// seven numbers fixes the column edges; runs are then assigned to (week, weekday) by position.
// The hockey calendar stacks "PUH" and "SNP" blocks inside each cell: a run belongs to the label
// above it in the same column.

let pdfjs = null;
async function loadPdfjs() {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'); // loaded lazily: only this rink needs it
  return pdfjs;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = (n) => String(n).padStart(2, '0');

// Text items -> runs of adjacent text on the same baseline.
export function mergeRuns(items) {
  // Group fragments into baselines first (y within 2.5pt), then read each baseline left to right.
  const lines = [];
  for (const it of [...items].filter((i) => i.s.trim()).sort((a, b) => a.y - b.y)) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - it.y) < 2.5) line.items.push(it); else lines.push({ y: it.y, items: [it] });
  }
  const runs = [];
  for (const line of lines) {
    let prev = null;
    for (const it of line.items.sort((a, b) => a.x - b.x)) {
      const gap = it.x - (prev?.right ?? -Infinity);
      if (prev && gap > -1 && gap < 6) {
        prev.text += (gap > 1.2 && !/\s$/.test(prev.text) && !/^\s/.test(it.s) ? ' ' : '') + it.s;
        prev.right = Math.max(prev.right, it.x + it.w);
      } else {
        prev = { x: it.x, y: it.y, right: it.x + it.w, text: it.s };
        runs.push(prev);
      }
    }
  }
  for (const r of runs) r.text = r.text.replace(/\s+/g, ' ').trim();
  return runs;
}

const TIME_RE = /^\*?\s*(\d{1,2}):(\d{2})\s*[^0-9:\s]{1,2}\s*(\d{1,2}):(\d{2})\s*(am|pm)?\s*\(?\s*([RB])\s*\)?\s*\*?$/i;

// "11:30-1:00 pm" -> start 11:30, end 13:00: the start takes the end's meridiem unless that puts it after the end.
export function parseTimeRun(text) {
  const m = TIME_RE.exec(text);
  if (!m) return null;
  const ap = (m[5] || 'am').toLowerCase();
  const to24 = (h, meridiem) => (Number(h) % 12) + (meridiem === 'pm' ? 12 : 0);
  const endH = to24(m[3], ap);
  let startH = to24(m[1], ap);
  if (startH * 60 + Number(m[2]) > endH * 60 + Number(m[4])) startH = to24(m[1], ap === 'pm' ? 'am' : 'pm');
  if (startH * 60 + Number(m[2]) > endH * 60 + Number(m[4])) return null;
  return { start: `${pad(startH)}:${m[2]}:00`, end: `${pad(endH)}:${m[4]}:00`, sheet: m[6].toUpperCase() === 'R' ? 'Red Rink' : 'Blue Rink', adultOnly: /^\*.*\*$/.test(text.trim()) };
}

// One page of runs -> [{ date, start, end, sheet, adultOnly, label }], where label is the PUH/SNP block (hockey calendar) or ''.
export function parsePageRuns(runs) {
  // "October 2026" may be one run or two ("October", "2026") on the same baseline.
  const monthRe = new RegExp(`^(${MONTHS.join('|')})\\s*(\\d{4})?$`, 'i');
  const monthRun = runs.find((r) => monthRe.test(r.text));
  if (!monthRun) return [];
  const mm = monthRe.exec(monthRun.text);
  const yearRun = runs.find((r) => Math.abs(r.y - monthRun.y) < 3 && /^\d{4}$/.test(r.text));
  const month = MONTHS.indexOf(mm[1].toLowerCase()) + 1;
  const year = Number(mm[2] ?? yearRun?.text ?? new Date().getFullYear());
  // Day-number runs: integers 1..31 below the month line, grouped into week rows by y.
  const nums = runs.filter((r) => r.y > monthRun.y && /^\d{1,2}$/.test(r.text) && Number(r.text) >= 1 && Number(r.text) <= 31);
  const weeks = [];
  for (const n of nums.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const w = weeks[weeks.length - 1];
    if (w && Math.abs(w.y - n.y) < 4) w.nums.push(n); else weeks.push({ y: n.y, nums: [n] });
  }
  // Keep rows that read as consecutive dates (drops stray numbers in footers).
  const dayWeeks = weeks.filter((w) => w.nums.every((n, i) => i === 0 || Number(n.text) === Number(w.nums[i - 1].text) + 1));
  const full = dayWeeks.find((w) => w.nums.length === 7);
  if (!full) return [];
  const edges = full.nums.map((n) => n.right + 3); // cell right edges, Sunday..Saturday
  const colOf = (x) => { const i = edges.findIndex((e) => x < e); return i === -1 ? 6 : i; };
  const out = [];
  dayWeeks.forEach((w, wi) => {
    const yTop = w.y;
    const yBottom = dayWeeks[wi + 1]?.y ?? Infinity;
    const dayByCol = new Map(w.nums.map((n) => [colOf(n.right - 1), Number(n.text)]));
    const body = runs.filter((r) => r.y > yTop + 2 && r.y < yBottom - 2).sort((a, b) => a.y - b.y);
    const labelByCol = new Map(); // hockey calendar: latest PUH/SNP label seen above, per column
    for (const r of body) {
      const col = colOf(r.x + 2);
      if (/^(PUH|SNP)$/i.test(r.text)) { labelByCol.set(col, r.text.toUpperCase()); continue; }
      const t = parseTimeRun(r.text);
      if (!t) continue;
      const day = dayByCol.get(col);
      if (!day) continue;
      out.push({ date: `${year}-${pad(month)}-${pad(day)}`, ...t, label: labelByCol.get(col) ?? '' });
    }
  });
  return out;
}

// PDF bytes -> parsed sessions from every page.
export async function parseCalendarPdf(bytes) {
  const { getDocument } = await loadPdfjs();
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, disableFontFace: true, verbosity: 0 }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const height = page.getViewport({ scale: 1 }).height;
    const tc = await page.getTextContent();
    const items = tc.items.map((i) => ({ x: i.transform[4], y: height - i.transform[5], w: i.width, s: i.str }));
    out.push(...parsePageRuns(mergeRuns(items)));
  }
  await doc.destroy();
  return out;
}
