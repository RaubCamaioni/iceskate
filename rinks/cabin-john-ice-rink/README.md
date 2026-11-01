# Cabin John Ice Rink (Rockville, MD)

| | |
|---|---|
| Address | 10610 Westlake Dr, Rockville, MD 20852 (Cabin John Regional Park) |
| Phone | (301) 765-8620 |
| Operator | Montgomery Parks (M-NCPPC) |
| Website | https://montgomeryparks.org/parks-and-trails/cabin-john-regional-park/cabin-john-ice-rink/ |
| Schedule pages | `.../cabin-john-ice-rink/schedules-info/` + `public-sessions/`, `hockey/`, `figure-skating/` |
| Sheets | NHL, Olympic |
| Online pre-pay | public skating is in person only; stick and puck and freestyle book on ActiveMONTGOMERY (WebTrac) |

Checked 2026-10-31. About 22 miles from Leesburg.

## Where the schedule comes from

There is no feed. The rink's WordPress pages are hand-edited blocks, cached ten minutes, no
bot protection, no CORS; `lib/montgomeryparks.js` parses them:

- **Public skating** (`public-sessions/`): one paragraph per weekday,
  `<p><strong>Monday</strong><br>8:00-9:15 am Cheapskate<br>9:30-11:00 am Adult Skate (age 18 and over)...`,
  valid for the season named in the heading ("Fall Public Skating Schedule, September 8 to
  March 31"). The adapter expands it over the requested dates. A note such as
  "(No session December 12 due to winter ice show)" removes that date for that slot.
- **Closures**: the "Important Dates" box ("November 26, 2026- Rink Closed") and the
  holiday-hours table on the schedules hub (Date | Day | Holiday hours: "Rink closed",
  "Rink closes at 3 pm", "Rink opens at noon").
- **Stick and Puck** (`hockey/`): a table Date | Day | Session Time of the next three to four
  weeks; "(Olympic)" marks the Olympic sheet, otherwise NHL.
- **Freestyle** (`figure-skating/`): a table Date | Day | Activity Code | Session Times for the
  current month; the times cell is a comma list such as "5:30-8:30 am Mixed use FS, 8:45-11:45
  am Mixed use FS, 4:30-6:00 pm Freestyle", sometimes "Low FS (NHL)", "Ice Dance 9:00-10:30 am",
  or "Thanksgiving - Rink Closed". The code links to WebTrac (`keyword=PCJI03nn`, one per day).

The booking backend is ActiveMONTGOMERY (Vermont Systems WebTrac at
mdmontgomeryctyweb.myvscloud.com). It is behind Cloudflare and Queue-it and needs a browser
session; it was not used.

### Classification

| Page text | Category | Title |
|---|---|---|
| Public Skate / Public Session | public_skate | |
| Cheapskate | public_skate | Cheapskate (includes rental) |
| Adult Skate / Adult Session | public_skate | Adults only (18+) |
| Parent and Tot | public_skate | Parent and Tot |
| Disco Skate | public_skate | Disco Skate |
| Stick and Puck rows | stick_and_puck | |
| FS / Freestyle / Mixed use FS / Low FS | freestyle | Mixed use, Low freestyle |
| Ice Dance, Skating Skills/Dance | figure_skating | as written |

## Repeat times (fall schedule, September 8 to March 31)

| Day | Session | Time |
|---|---|---|
| Mon to Fri | Cheapskate | 8:00 to 9:15am |
| Mon, Tue, Thu | Adult skate | 9:30 to 11:00am |
| Mon, Wed, Fri | Parent and Tot | 11:00am to 12:00pm |
| Mon to Fri | Public skate | 12:30 to 2:30pm and 4:30 to 6:15pm |
| Tue | Public skate | 8:30 to 10:00pm |
| Thu | Adult skate | 8:30 to 10:00pm |
| Fri | Disco Skate | 8:00 to 10:00pm |
| Sat | Public skate | 12:00 to 2:00pm, 4:00 to 6:00pm, 8:30 to 10:00pm |
| Sun | Public skate | 8:00 to 9:30am, 12:00 to 2:00pm, 4:00 to 6:00pm |
| Mon to Fri | Freestyle | from 5:30am, most of the morning, plus afternoons |

## Costs (public-sessions page, 2026-10-31)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Regular (age 5 and up) | admission | 1 | $9 | $9 |
| Tots (ages 3 to 4) | admission | 1 | $5 | $5 |
| Senior (60+), weekdays | admission | 1 | $7 | $7 |
| Cheapskate (admission + rental) | admission | 1 | $9 | $9 |
| Parent and Tot (one adult + one tot, with rentals) | admission | 1 | $10 | $10 |
| Skate rental | pair | 1 | $4 | $4 |
| Discount ticket book | 10 admissions | 10 | $81 | $8.10 |
| Stick and Puck | session | 1 | $11 to $15 by length | |
| Freestyle | 30 minutes | 1 | $9 | |
| Freestyle punch pass | 20 / 40 / 80 sessions | 20 / 40 / 80 | $160 / $300 / $520 | $8 / $7.50 / $6.50 |

Freestyle punch passes work at Cabin John and Wheaton.

## Gotchas

- The weekly template is only as current as the page; a new season heading means new times.
  The page's `article:modified_time` meta is a cheap change detector.
- Dates on the stick-and-puck and freestyle tables carry no year; the parser picks the year
  nearest the requested window.
- Coordinates are the park's (approximate); Nominatim does not resolve the street address.

## Samples

`samples/*-2026-10-31.html`: the `<main>` content of the four pages as published.
