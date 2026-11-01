# Fairfax Ice Arena

| | |
|---|---|
| Address | 3779 Pickett Rd, Fairfax, VA 22031 |
| Phone | (703) 323-1132 |
| Website | https://www.fairfaxicearena.com |
| Prices page | https://www.fairfaxicearena.com/public-skate-hours.html |
| Sheets | one, Main Rink (resource 1) |
| Online pre-pay | public skate is box office only; pick-up hockey is sold in DASH; freestyle uses Mindbody credits |

Checked 2026-10-31.

## Where the schedule comes from

Two systems.

### 1. DaySmart Recreation ("DASH"), company slug `fairfax` (used by the adapter)

Public skate, pick-up hockey, group lessons and private rentals.

```
GET https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/events
    ?company=fairfax
    &filter[start__gte]=2026-10-31T00:00:00&filter[start__lte]=2026-11-07T23:59:59
    &filter[publish]=1&filter[resource_id__in]=1
    &filter[event_type_id__in]=10,11,k,c,8,16,g
    &include=summary,resource&page[size]=500&sort=start
```

| id | DASH name | Category |
|---|---|---|
| 10 | Public Skate Weekday | public_skate |
| 11 | Public Skate Weekend/Holiday | public_skate |
| k | Camp = pick-up hockey (a player row and a goalie row per slot; the goalie row is hidden) | pickup_hockey |
| c | Class (group lessons; their "FREESTYLE 1-5" names are lesson levels, not sessions) | learn_to_skate |
| 8, 16 | Freestyle Session (defined, unused) | freestyle |
| r | Rental (private) | hidden |

Always pass `filter[publish]=1`: unpublished rows are private party bookings whose `desc`
holds customer names. All other resources are party rooms and reservation slots. CORS echoes
any origin.

### 2. Mindbody (freestyle only, not pulled yet)

Freestyle sessions live in Mindbody classic, studio 47692, server-rendered HTML behind a
session cookie: first `GET https://clients.mindbodyonline.com/classic/ws?studioid=47692&stype=-7&sTG=2&sView=week&sLoc=1&sTrn=2`
with a cookie jar, then `GET /classic/mainclass?studioid=47692&stype=-7&view=week&date=M/D/YYYY&loc=1&tg=2`.
Parse `div#classSchedule-mainTable`: `div.header` dates, `div.evenRow|oddRow` rows with the
start time, class name ("Freestyle 1 & Up (Mix)- 40 minute (4 credits)"), duration and
"(n Reserved, m Open)". Drop the daily 1:00am "Late Add Service Fee" rows. About 75 rows a
week. Worth adding when freestyle matters; it is off by default on the site.

## Repeat times

Public skate hours are posted on the prices page and change seasonally; the DASH feed is
authoritative. Pick-up hockey is listed in DASH event registration.

## Costs (public-skate-hours page, 2026-10-31)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Public skate, weekday | admission | 1 | $10.25 | $10.25 |
| Public skate, weekend / holiday | admission | 1 | $11.25 | $11.25 |
| Public skate punch card | 10 admissions | 10 | $83 | $8.30 |
| Group of 7 or more | admission | 1 | $6 weekday / $6.75 weekend | |
| Skate rental | pair | 1 | $4 | $4 |
| Pick-up hockey | session | 1 | $20 | $20 |
| Freestyle credits | 40 credits | about 7 to 10 sessions | $124 | $12.40 to $17.70 |
| Freestyle credits | 180 credits | about 30 to 45 sessions | $406 | $9.00 to $13.50 |

Freestyle sessions cost 4 to 6 credits each depending on length.

## Samples

`samples/events-sample.json` (published events only), `samples/event-types.json`, `samples/resources.json`.
