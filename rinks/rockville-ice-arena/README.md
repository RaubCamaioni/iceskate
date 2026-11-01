# Rockville Ice Arena (Rockville, MD)

| | |
|---|---|
| Address | 50 Southlawn Ct, Rockville, MD 20850 |
| Phone | (301) 315-5650 |
| Website | https://www.rockvilleicearena.com |
| Prices page | https://www.rockvilleicearena.com/page/show/2944804-public-and-stick-time-ice-schedules |
| Sheets | three, but the published schedule never says which one a session is on |
| Online pre-pay | none for public skate or stick time (pay at the desk) |

Checked 2026-10-31. About 23 miles from Leesburg.

## Where the schedule comes from

SportsEngine (NGIN Sitebuilder, site 14231). The public-skating and stick-time calendar entries
are tagged, and the site's own "Subscribe to iCal" link exposes them as a feed:

```
GET https://www.rockvilleicearena.com/ical_feed?tags=3080364,3080365      (3080364 Public Skating, 3080365 Stick Time)
```

`text/calendar`, about 35 KB, one `VEVENT` per occurrence (no `RRULE`), `DTSTART`/`DTEND` with
`TZID=America/New_York`, `UID:event_<id>_ngin.com`, `SUMMARY` one of "Public Skating", "Stick
Time", "Stick Time - Youth". `LOCATION` is always empty. No date parameters and no paging: the
feed returns everything published (currently about a month ahead; December is entered late
November). No CORS, `Cache-Control: no-store`; fetched server-side. An RSS feed of upcoming
events exists too (`/event_rss_feed?tags=...`).

Not in the feed: **freestyle** (a monthly PNG on the website; Nov 2026 was Mon to Fri 5:50 to
11:50am on Rink 2) and lessons (a static Learn-to-Skate page). No drop-in hockey is offered.

### Classification

| Summary | Category | Title |
|---|---|---|
| Public Skating | public_skate | |
| Stick Time | stick_and_puck | |
| Stick Time - Youth (13 and under) | stick_and_puck | Youth (13 and under) |

## Repeat times (Nov 2026, from the feed)

Public skating and stick time run most days, often at the same time on different sheets
(for example Friday 12:00 to 2:00pm). See the live list; the feed is the authority.

## Costs (prices page, 2026-10-31)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Public skating | admission | 1 | $11 | $11 |
| Skate rental | pair | 1 | $4 | $4 |
| Stick time (goalies free) | session | 1 | $18 | $18 |
| Freestyle | hour | 1 | $18 | $18 |
| Freestyle monthly | month | unlimited | $305 to $355 | |

## Gotchas

- The HTML month view prints wrong UTC offsets in its `title` attributes; use the ICS or RSS.
- The feed is Cloudflare-fronted; a browser-like user agent is sent.
- Whether the feed caps at 100 events is unknown (it had exactly 100 on 2026-10-31, which
  matched the per-tag sums, so probably not).

## Samples

`samples/feed-2026-10-31.ics`: the full feed as fetched (100 events).
