# Haymarket IcePlex

| | |
|---|---|
| Address | 15155 Washington St, Haymarket, VA 20169 |
| Phone | (703) 753-4423 |
| Website | https://www.haymarketiceplex.com (SportsEngine) |
| Public calendar | https://apps.daysmartrecreation.com/dash/x/#/online/haymarketice/calendar |
| Prices page | https://www.haymarketiceplex.com/page/show/8611769-pricing |
| Sheets | Rink - North (resource 1), Rink - South (resource 7) |
| Online pre-pay | none per session; 10-pass packages through a DASH account |

Checked 2026-10-31.

## Where the schedule comes from

DaySmart Recreation ("DASH"), company slug **`haymarketice`**, the same JSON:API as Ashburn
(see `rinks/ashburn-ice-house/README.md` for the API notes). The site's own /calendar is
empty and has no ICS; DASH is the only machine-readable source.

```
GET https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/events
    ?company=haymarketice
    &filter[start__gte]=2026-10-31T00:00:00&filter[start__lte]=2026-11-14T23:59:59
    &filter[publish]=1&filter[resource_id__in]=1,7
    &filter[event_type_id__in]=8,11,12,14,15,16,18,19,20,21,9,g,c,k
    &include=summary,resource&page[size]=500&sort=start
```

Two weeks is about 230 events in one page. CORS echoes any origin. Lookups:
`/event-types`, `/resources`, `/facilities` with `?company=haymarketice`.

### Classification (by `event_type_id`; titles are free text with typos such as "Frestyle")

| id | DASH name | Category |
|---|---|---|
| 8 | Public Skating Session | public_skate |
| 12 | Freestyle | freestyle |
| 11, 14 | Stick and Shoot, 12U Stick and Shoot | stick_and_puck |
| 16 | Adult Pick Up Hockey | pickup_hockey (defined, none scheduled through Dec 2026) |
| 19, 15, c | Learn to Skate, LTPH/FCLTP, Class | learn_to_skate |
| 20, 21, 9, g | Power Skating, Hockey Skills, Piedmont Hockey Club, Game | hockey |
| 18, k | Home Schooling Ice, Camp | other |
| r, b, L, 10, 17, 13 | Rental, Block, Locker Room, Parties, Room Rental, Private Lesson | hidden |

Titles that only repeat the category ("Public Skate", "Freestyle", "Stick n Shoot") are
blanked; themed ones ("Public Skate- HALLOWEEN SKATE in costume") are kept.

## Repeat times (Nov to mid-Dec 2026, from the feed)

| Day | Session | Sheet | Time |
|---|---|---|---|
| Mon | Stick and Shoot | North | 3:30 to 4:50pm |
| Mon | Freestyle | South | 3:30 to 4:30pm |
| Mon | Public skate | South | 4:30 to 6:00pm |
| Tue, Wed | Stick and Shoot | North | 3:30 to 4:50pm |
| Fri | Public skate | North | 3:30 to 4:50pm |
| Fri | Freestyle | South | 3:40 to 5:50pm |
| Fri | Stick and Shoot | North | 5:00 to 6:20pm |
| Fri | Public skate | South | 7:30 to 8:50pm |
| Sat | Public skate | South | 11:00am to 12:40pm |
| Sat | Freestyle | South | 12:50 to 2:50pm |
| Sat | Public skate | North or South | 6:00 to 7:30pm |
| Sun | Public skate | South | 3:30 to 5:00pm |

## Costs (pricing page, 2026-10-31)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Public skating | admission | 1 | $10 | $10 |
| Skate rental | pair | 1 | $4 | $4 |
| Freestyle | session | 1 | $15 | $15 |
| Stick N Shoot | session | 1 | $15 | $15 |
| Freestyle / Stick N Shoot package | 10-pass | 10 | $135 | $13.50 |

Packages are bought through a DASH account (https://apps.daysmartrecreation.com/dash/x/#/online/haymarketice/login).

## Gotchas

- Without `filter[publish]=1` the API returns unpublished locker-room assignments naming visiting teams.
- `description`, `notice` and `best_description` are always null; `desc` / summary `name` is the only title.
- Summaries include booking balance fields for rentals; they are never stored (samples are scrubbed).

## Samples

`samples/events-sample.json` (six events with summaries and both rink resources),
`samples/event-types.json`, `samples/resources.json`.
