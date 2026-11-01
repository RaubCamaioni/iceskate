# SKATE Frederick (Frederick, MD)

| | |
|---|---|
| Address | 1288 Riverbend Way, Frederick, MD 21701 |
| Phone | (301) 662-7362 |
| Website | https://skatefrederick.com |
| Prices page | https://skatefrederick.com/public-skating/ |
| Sheets | Sheet 1, Sheet 2 |
| Online pre-pay | none found for public skate (pay at the door); programs register through a Frontline Connect portal |

Checked 2026-10-31. About 21 miles from Leesburg across the river.

## Where the schedule comes from

WordPress with **The Events Calendar** (Tribe). Its REST API is open, CORS-enabled, and returns
every event with categories:

```
GET https://skatefrederick.com/wp-json/tribe/events/v1/events?start_date=2026-10-31&end_date=2026-11-07&per_page=50&page=1
```

`{ events[], total, total_pages, next_rest_url }`; `per_page` caps at 50, so a week is two pages
and a month about six. The date filter is day-granular. An ICS export exists
(`/calendar/month/2026-11/?ical=1`) but is capped at about 30 events, so it is not used.

### Fields used

- `start_date` / `end_date`: `YYYY-MM-DD HH:MM:SS` local (`timezone: America/New_York`).
- `categories[].slug`: `public-skating`, `stick-and-shoot`, `freestyle`, `learn-to-skate`,
  `specialty-training`, `camps-clinics`, `ice-hockey`, `figure-skating`. Events with no category
  are private rentals and are dropped. There is no drop-in hockey category.
- `description`: HTML whose first line is `<h4>Sheet 1</h4>` or `<h4>Sheet 2</h4>` (the venue is
  one record); that is the only place the sheet appears.
- `title`: "Public Skating", "Public Skating – Cheapskate", "Public Skating – Friday Chill Out",
  "Freestyle", "Stick &#038; Shoot", lesson names, hockey club names. HTML entities are decoded.
- `id` is not stable for recurring occurrences (provisional ids over 10,000,000), so events are
  keyed on start, end, sheet and title; the feed also sometimes lists the same event twice.

### Classification

| Category slug | Category | Title shown |
|---|---|---|
| public-skating | public_skate | the variant only: "Cheapskate", "Friday Chill Out" |
| stick-and-shoot | stick_and_puck | |
| freestyle | freestyle | |
| learn-to-skate, specialty-training, camps-clinics | learn_to_skate | class name |
| ice-hockey | hockey | club or league name |
| figure-skating alone | figure_skating | |

## Repeat times (Nov to mid-Dec 2026, from the feed; all on Sheet 1)

| Day | Session | Time |
|---|---|---|
| Mon, Wed, Fri | Public skate | 10:30am to 12:30pm |
| Tue, Thu | Cheapskate public skate | 11:00am to 12:30pm |
| Fri | Friday Chill Out public skate | 8:00 to 10:00pm |
| Sat, Sun | Public skate | 2:00 to 5:00pm |
| Mon to Fri | Freestyle | 6:00 to 9:00am and mid-afternoon |
| Sat | Freestyle | 11:45am to 1:45pm |
| Sun | Stick & Shoot | occasional, around noon |

## Costs (public-skating page, 2026-10-31)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Public skate, weekday (Mon/Wed/Fri), child / adult / senior | admission | 1 | $7 / $7.50 / $6 | |
| Cheapskate (Tue/Thu) | admission | 1 | $6 | $6 |
| Friday Chill Out | admission | 1 | $8 | $8 |
| Public skate, weekend, child / adult / senior | admission | 1 | $10 / $11 / $8 | |
| Skate rental | pair | 1 | $3 to $4 | |
| Stick & Shoot | session | 1 | $12 (goalies $6) | $12 |

## Gotchas

- `cost` is always empty in the API; prices are only in the description HTML and the website.
- The contact page returns 403 to plain curl; the API does not.
- Events are mostly on Sheet 1; hockey fills Sheet 2.

## Samples

`samples/events-sample.json` (five events with categories and descriptions), `samples/categories.json`.
