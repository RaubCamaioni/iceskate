# Ashburn Ice House

| | |
|---|---|
| Address | 21595 Smith Switch Rd, Ashburn, VA 20147 |
| Public website | https://www.ashburnice.com (SportsEngine site builder, site id 6690) |
| Schedule vendor | DaySmart Recreation ("DASH"), company slug `ashburn` |
| Registration vendor | DaySmart Recreation member portal |
| Timezone | America/New_York |
| Verified | 2026-10-31 |

## Summary

The ashburnice.com site is a SportsEngine shell. Every schedule and registration link
on it points into DaySmart Recreation at `apps.daysmartrecreation.com` (older links
use `apps.dashplatform.com`, same system). DaySmart exposes a JSON:API that answers
**without any login** and **sends CORS headers**, so a browser-only frontend can call it
directly. It returns every event on every resource in the building, including rooms,
locker rooms, and a private-coach pseudo-resource, so filtering is essential.

## Ice surfaces (DaySmart "resources")

| id | Name | Notes |
|----|------|-------|
| 1 | East Rink | main sheet |
| 2 | West Rink | main sheet; most public skates and classes run here |
| 8 | Outdoor Rink | seasonal |

Other resources you will see and should ignore for a schedule view: 0 Unscheduled,
3 East Party Room, 4 West Party Room, 5 Mezzanine, 6 Studio, 7 Inside Edge Center,
9-20 locker rooms LR-1 to LR-12, 21 Private Coach Resource, 22-23 Away Game.
Facility 1 is Ashburn Ice House, facility 2 is "Inside Edge" (the gym).

Full list: `samples/resources.json`.

## Endpoints

Base URL (all calls need `company=ashburn`):

```
https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/
```

The API follows the [JSON:API](https://jsonapi.org) spec: `data[]` with
`type`/`id`/`attributes`/`relationships`, related objects in `included[]`,
pagination in `meta.page` and `links`.

### Events (the schedule)

```
GET /events?company=ashburn
    &filter[start__gte]=2026-11-01T00:00:00
    &filter[start__lte]=2026-11-01T23:59:59
    &filter[resource_id__in]=1,2
    &include=summary,resource
    &page[size]=200
```

- `filter[<field>__gte]`, `__lte`, `__in` work. A bare comma list
  (`filter[resource_id]=1,2`) silently matches only the last value; use `__in`.
- Datetimes are local wall-clock with no offset. `start_gmt`/`end_gmt` are UTC.
- `page[size]` up to at least 200; follow `links.next` for more.
- Default sort is `start`.
- Without a date filter the endpoint returns the entire history (9,400+ events).

Useful `include` values: `summary` (public-facing name and type label),
`resource` (rink name), `eventType`, `homeTeam`, `league`.
Including `program,season,product` returned HTTP 500.
**Never include `customer` or `registrations`**; those are personal data.

Example trimmed response: `samples/events-2026-11-01.json`.

### Reference lists

```
GET /resources?company=ashburn        rinks, rooms, locker rooms
GET /event-types?company=ashburn      44 types with colours and default lengths
GET /facilities?company=ashburn       Ashburn Ice House + Inside Edge, with lat/lng
GET /programs?company=ashburn         Learn to Skate USA etc. (HTML descriptions)
GET /seasons?company=ashburn          400+ seasons back to 2020
GET /products?company=ashburn         334 products with prices (passes live here)
```

All return 500 per page by default. Samples for resources, event types, and the
pass-related products are in `samples/`.

### Endpoints that refuse without login

`/memberships` and `/passes` return 403. `/companies`, `/levels`, `/membership-types`
return 404 (wrong route names, not auth).

## Field notes (events)

| Attribute | Meaning |
|-----------|---------|
| `start`, `end` | local datetime, no offset |
| `start_gmt`, `end_gmt` | UTC equivalents |
| `resource_id` | ice surface or room, see table above |
| `event_type_id` | key into event-types; single letters are built-ins (`k` Camp, `c` Class, `g` Game, `b` Block, `r` Rental, `L` Locker Room), numbers are custom |
| `desc` | staff-entered label, often empty for public sessions |
| `best_description` | HTML blurb shown on the registration page |
| `publish` | `false` means hidden from the public calendar; hide it too |
| `register_capacity` | max registrants; 0 for non-registerable events |
| `repeat_id` | groups a recurring series |
| `hteam_id`, `vteam_id`, `league_id` | game/practice relations |
| `create_u`, `mod_u`, `create_d`, `mod_d` | staff username and timestamps; **do not store or display** |

The public-facing session name is **not** in `desc`. It is in the included
`event-summaries` record (`included[].type == "event-summaries"`, same id as the
event): `name`, `event_type`, `color`, `publish`. The same name is also on the
related `teams` record via `homeTeam`.

## Session categories

The obvious event types are mostly unused. Type 8 "Public Skate", 16 "Freestyle",
18 "Stick-N-Shoot", 19 "Adult Pick-up Hockey" and 29 "Public Group Skate" returned
zero events over a two-week window.

Instead, every drop-in session the public can register for is event type **`k`
("Camp")** with a non-zero `register_capacity`. Classify by the summary `name`:

| Summary name contains | Category | Typical capacity |
|-----------------------|----------|------------------|
| "Public Skate" | public_skate | 300 |
| "Adult" + "public skate" | public_skate (adults only) | 300 |
| "Playground on Ice" | public_skate (ages 2-8) | 150 |
| "Freestyle" / "Freeskate" | freestyle | 28 |
| "Fast Track", "Drop-in ... class" | learn_to_skate | 12-50 |
| "Adaptive" | learn_to_skate | 6 |

Type `c` "Class" rows are scheduled Learn to Skate classes (Snowplow, Basic 1-6,
Adult 1, Jr. Hockey). Type `g` "Game", `21` "Team Practice", `26` "Xtreme Game",
`40` "Edge Home Game" are hockey. Type `b` "Block" rows are 10-minute setup
blocks between games and should be hidden.

## What the feed shows that the website does not

- **Unpublished events** (`publish: false`), e.g. Theater on Ice ice-time holds.
- **Capacity** for every registerable session.
- **Every room and locker room booking**, not just the ice.
- **Staff usernames and edit timestamps** on every event.
- **Product catalogue with prices**, including multi-session passes.
- **Internal ids** (league, season, team, product, booking) for joining tables.

## Regular public skate times

Derived from `/events` for 2026-11-02 through 2026-12-13 (six weeks, 672 Camp-type
events on the three ice resources). A slot is listed if it appeared in three or more
weeks. Session names below are the DaySmart summary names.

| Day | Time | Rink | Summary name | Weeks seen |
|-----|------|------|--------------|------------|
| Mon | 10:30-11:30 | West | Public-Weekday Morning | 3 (from Nov 16) |
| Mon | 15:50-16:50 | West | Public-Weekday Afternoon | 3 (from Nov 16) |
| Mon | 09:20-10:20 | West | Playground on Ice- Fall | 3 (from Nov 16) |
| Tue | 10:30-11:30 | West | Public-Weekday Morning | 3 |
| Wed | 14:00-15:00 | West | Public-Weekday Afternoon | 3 |
| Wed | 10:30-11:30 | West | Playground on Ice- Fall | 3 |
| Thu | 12:00-13:30 | West | Public-Weekday Afternoon | 3 |
| Thu | 16:50-17:50 | West | Public-Weekday Afternoon | 3 |
| Fri | 10:30-11:30 | West | Public-Weekday Morning | 3 |
| Fri | 20:10-21:10 | West | Public- Friday Rockin' Skate | 4 |
| Fri | 09:20-10:20 | West | Playground on Ice- Fall | 3 |
| Sat | 12:50-13:50 | West | Public-Weekend Afternoon | 5 |
| Sat | 16:10-17:10 | West | Public-Weekend Afternoon | 3 |
| Sat | 09:40-10:30 | West | Playground on Ice- Weekend | 2 |
| Sun | 14:00-15:00 | West | Public-Weekend Afternoon | 5 |
| Sun | 09:40-10:40 | East | Playground on Ice- Weekend | 2 |

Notes:

- Early November (Nov 2-13) ran a different Monday pattern: Playground 10:30-11:30
  and Public 11:40-13:10. The schedule settled into the table above from Nov 16.
- Thanksgiving week (Nov 25-29) added evening and extra afternoon public skates on
  both rinks; treat holiday weeks as exceptions.
- December sessions carry a "(Dec)" suffix in the name but keep the same times.
- Freestyle: East Rink, 30-minute blocks, 05:30 to roughly 17:30 every weekday
  (names "Freestyle- Weekdays before 12pm" / "after 12pm"); West Rink Sunday
  10:10-11:40 ("Freestyle- Weekends").
- Stick n Shoot: Mon 08:00-09:00, Wed 06:00-08:00, Thu 10:30-11:40, plus weekday
  afternoons Mon/Tue 12:00-13:30 and Mon 15:10-16:30 (West Rink).
- Adult pick-up hockey: Wed 12:00-13:30, Fri 08:10-09:10 and 12:10-13:40 (West Rink).

## Costs

From the `products` endpoint, which is what the DaySmart checkout charges
(2026-10-31). Admission does not include skate rental unless stated.

### Single sessions

| Item | Unit | Sessions | Price | Per session | Product id |
|------|------|----------|-------|-------------|------------|
| Public Skate, general (online or walk-in) | admission | 1 | $15.00 | $15.00 | 104, 265 |
| Public Skate, child | admission | 1 | $8.00 | $8.00 | 17 |
| Public Skate, senior | admission | 1 | $5.00 | $5.00 | 19 |
| Public Skate, group | per person | 1 | $10.00 | $10.00 | 18 |
| Skate rental | per pair | 1 | $5.00 | $5.00 | 4 |
| Playground on Ice | per child; includes one adult chaperone and both rentals; extra adult $18 | 1 | $18.00 | $18.00 | 244, 266 |
| Playground on Ice, themed event | per child | 1 | $20.00 | $20.00 | 240 |
| Freestyle | single session | 1 | $10.00 | $10.00 | 199, 337 |
| Stick n Shoot | admission | 1 | $20.00 | $20.00 | 21 |
| Pick Up Hockey | admission | 1 | $20.00 | $20.00 | 22, 268 |
| HS game admission | admission | 1 | $8.00 | $8.00 | 234, 270 |

Holiday-deal variants: Public Skate $10 (164), Public Skate/POI $12.50 (16),
Playground $15.50 (330), Pick Up Hockey $17.50 (327), Stick n Shoot $17.50 (328).

### Passes and memberships

| Item | Unit | Sessions | Price | Per session | Product id |
|------|------|----------|-------|-------------|------------|
| 11 Session Public Skate Pass | pass | 11 | $72.00 | $6.55 | 25 |
| 22 Session Public Skate Pass | pass | 22 | $120.00 | $5.45 | 26 |
| Frequent Skater Public Skate Pass | per session; session count not published | ? | $12.00 | $12.00 | 151 |
| Public Pass Package | per session; count not published | ? | $12.00 | $12.00 | 193 |
| Public Skate Package | per session; count not published | ? | $15.00 | $15.00 | 198 |
| Freestyle Punch Pass 20 | punch pass, catalogue lists $10 per punch | 20 | $200.00 | $10.00 | 201 |
| Freestyle Punch Pass 40 | punch pass | 40 | $400.00 | $10.00 | 202 |
| Freestyle Punch Pass 60 | punch pass | 60 | $600.00 | $10.00 | 203 |
| Freestyle Punch Pass 80 | punch pass | 80 | $800.00 | $10.00 | 204 |
| Freestyle Punch Pass 100 | punch pass | 100 | $1,000.00 | $10.00 | 205 |
| Drop in hockey pass | per session; count not published | ? | $20.00 | $20.00 | 170 |
| Public Skating Crew Membership | membership; benefits not published | n/a | $50.00 | n/a | 263 |
| Priority Bypass Membership | membership; benefits not published | n/a | $0.00 | n/a | 326 |

The catalogue stores punch passes at the per-punch price, so pass totals above are
sessions times $10 and should be confirmed at checkout.

Purchasing happens in the authenticated portal at
`https://apps.daysmartrecreation.com/dash/x/#/online/ashburn/...`. There is no
unauthenticated purchase endpoint and none was attempted. Full product sample:
`samples/products-passes.json`.

## Gotchas

- `filter[x]=a,b` does not work; use `filter[x__in]=a,b`.
- A date filter without a time (`2026-10-31`) is treated as midnight, so
  `start__lte=2026-11-01` excludes all of Nov 1.
- Spaces in filter values break the request; use `T` between date and time.
- `included[]` is only populated for relationships you name in `include`.
- Hockey games have empty `desc`; the matchup is only in the summary name.

## CORS

Responds with `access-control-allow-origin: <request origin>` and
`access-control-allow-credentials: true`. A browser can call it directly.

## Adapter

`adapter.js` in this folder pages through `/events` for the three ice resources,
drops unpublished rows, setup blocks, and staff fields, and normalises the rest.
`classify(summaryName, eventTypeName)` maps DaySmart names to the shared categories.
Tests: `test/adapters.test.js` against `samples/events-2026-11-01.json`.

## Samples

Produced with `curl` on 2026-10-31 and trimmed to a handful of records each.
Staff username and timestamp fields were removed.

- `samples/events-2026-11-01.json` — East and West Rink events for one day with `summary` and `resource` included
- `samples/resources.json` — all 24 resources
- `samples/event-types.json` — all 44 event types
- `samples/products-passes.json` — products whose names mention passes or drop-in sessions
