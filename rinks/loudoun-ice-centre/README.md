# Loudoun Ice Centre (Sterling)

| | |
|---|---|
| Address | 22149 Davis Dr, Suite 155, Sterling, VA 20164 |
| Phone | (703) 444-0600 |
| Website | https://www.loudounice.com |
| Schedule page | https://www.loudounice.com/calendar |
| Prices page | https://www.loudounice.com/public-skating |
| Sheets | one small studio rink (about 80 ft x 50 ft) |
| Online pre-pay | none found; pay at the door |

Checked 2026-10-31.

## Where the schedule comes from

The website is Wix. The calendar page embeds a **public Google Calendar** through a Wix HTML
component (`https://www-loudounice-com.filesusr.com/html/d786db_a1d1053b77c518d8e04b30a476d7e1f6.html`
→ `https://calendar.google.com/calendar/embed?src=scheduler%40loudounice.com&ctz=America%2FNew_York`).

A public Google Calendar always exposes an iCalendar feed:

```
GET https://calendar.google.com/calendar/ical/scheduler%40loudounice.com/public/basic.ics
```

Returns `text/calendar`, ~330 KB, ~740 VEVENTs going back to 2019, no authentication, no
rate limiting seen, `cache-control: no-cache`. No CORS headers, so the server (or the daily
build) fetches it, never the browser.

### Feed characteristics

- About 130 events carry an `RRULE`, nearly all `FREQ=WEEKLY` with `BYDAY`, many with
  `UNTIL` (some written as date-only `UNTIL=20220531`, which must be handled), a few with
  `COUNT`. 74 have `EXDATE`s and ~190 are `RECURRENCE-ID` overrides (moved or renamed
  single occurrences). `lib/ics.js` expands all of this.
- Times are mostly `TZID=America/New_York`; a few older entries are UTC (`...Z`).
- Closures are all-day events (`DTSTART;VALUE=DATE`) with summaries like `CLOSED - Happy
  Easter!`; they are skipped.
- There is no sheet field (one rink). No capacity, no price, no registration link in the
  feed. `DESCRIPTION` is occasionally used for notes.

### Summaries seen (most common first)

`Public Skate`, `Cheap Skate`, `Stick N' Shoot` / `Stick & Shoot`, `Learn to Skate`,
`Cheap Skate & Turkey Shoot`, `Glow Broomball`, holiday variants (`Ugly Sweater Public
Skate`, `Halloween Public Skate`, `Skate with Santa`, `Holiday Pajama Skate`), `Goalie
Rookie Program`, `Player Rookie Program`, `Glow Hockey`, `Youth Open Hockey`, `Adult Hockey
Clinic`, `Parent's Night Out`, `Winter Fun Camp`, `CLOSED ...`.

### Classification (adapter.js)

| Summary contains | Category |
|---|---|
| closed | dropped |
| learn to skate, lesson | learn_to_skate |
| stick, shoot | stick_and_puck |
| open hockey, pick up, drop-in hockey | pickup_hockey |
| broomball, hockey, rookie program, clinic, 3v3, tourney, goalie, player | hockey |
| skate / skating (public, cheap, holiday variants) | public_skate |
| anything else (camps, parties, coach bookings) | other |

The title is blanked when it is just "Public Skate" (the category already says that);
"Cheap Skate" and the holiday names are kept because they change the price or the theme.

## Repeat times (Nov to mid-Dec 2026, from the feed)

| Day | Session | Time |
|---|---|---|
| Tue | Stick & Shoot | 11:30am to 12:50pm |
| Wed, Thu, Fri | Cheap Skate | 11:30am to 1:00pm |
| Sat | Public Skate | 7:00pm to 8:30pm |
| Sat | Goalie / Player Rookie Program | 3:45pm to 4:45pm |
| Sun | Player Rookie Program | 8:30am to 9:30am |
| Sun | Goalie Rookie Program | 4:20pm to 5:20pm |
| Sun | Glow Broomball | 6:35pm to 7:35pm |

Holiday-themed public skates are added on individual dates. Check the live list.

## Costs (public-skating page, 2026-10-31)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Public skate, child 12 and under | admission | 1 | $8 | $8 |
| Public skate, adult | admission | 1 | $10 | $10 |
| Skate rental | pair | 1 | $5 | $5 |
| Cheap Skate (admission + rental) | admission | 1 | $6 | $6 |

Cheap Skate runs on selected weekdays during the school year, not on holidays. No passes
or multi-session bundles are published.

## Gotchas

- The whole history since 2019 is in one file; always expand with a date window.
- `UNTIL` can be a bare date. Treating it as "no end" resurrects old series (seen: a 2022
  Monday Cheap Skate reappearing in 2026).
- Google occasionally stamps single events in UTC; convert to Eastern before comparing.
- The embed URL and calendar id could change if the website is rebuilt; the calendar id is
  in `adapter.js` (`CALENDAR_ID`).

## Samples

`samples/basic-trimmed.ics`: six representative VEVENTs from the real feed (a weekly series
with UNTIL, a COUNT series, two overrides, an all-day closure, a UTC-stamped event), with
non-schedule properties removed.
