# MedStar Capitals Iceplex (Arlington)

| | |
|---|---|
| Address | 627 N Glebe Rd, Suite 800, Arlington, VA 22203 (Ballston Quarter rooftop) |
| Phone | (571) 224-0555 |
| Website | https://www.medstarcapitalsiceplex.com (SportsEngine) |
| Sheets | Capitals Rink (resource 1), Arlington Rink (resource 2) |
| Online pre-pay | yes, every drop-in session is sold in DASH (account required) |
| Drop-in checkout | https://apps.daysmartrecreation.com/dash/x/#/online/capitals/event-registration?&program_types=3 |

Checked 2026-10-31. The website has no prices page; prices are only inside the DASH widget.

## Where the schedule comes from

DaySmart Recreation ("DASH"), company slug **`capitals`**. Same API as Ashburn, with one
twist: like Ashburn, every drop-in is event type `k` ("Camp"), and what it is comes from the
**league's sport**, so the fetch adds `include=league`.

```
GET https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/events
    ?company=capitals
    &filter[start__gte]=2026-11-02T00:00:00&filter[start__lte]=2026-11-09T23:59:59
    &filter[publish]=1&filter[resource_id__in]=1,2
    &include=summary,resource,league&page[size]=500&sort=start
```

A week on both sheets is about 400 rows. `include=fees` is 403, so there are no live prices.
Lookups that work: `resources`, `event-types`, `sports`, `programs`, `leagues`, `facilities`,
`products`. CORS echoes any origin.

### Classification (adapter.js)

| Rule | Category |
|---|---|
| type `k`, league sport 27 (Public Skating): "Public Skate ...", "Recess", "Adult Swim", "Arlington County Senior Skate" | public_skate |
| type `k`, sport 24 (Figure Skating) and title contains "freestyle" (monthly league, e.g. "Freestyle- November 2026") | freestyle |
| type `k`, sport 24 otherwise (Sky High Skating Academy classes) | learn_to_skate |
| type `k`, sport 31 (Stick n Shoot, incl. "Mini Stick n Shoot") | stick_and_puck |
| type `k`, sport 32 (Pickup Hockey); the parallel "Goalie" row for the same slot is hidden | pickup_hockey |
| type `c` (Class: Learn to Skate USA, adult groups), type `8` with "LTP" | learn_to_skate |
| `16` DC Edge synchro | figure_skating |
| `10` Team Practice, `g` Game, `9` RHL, `24`/`25`/`31` home/away games, `15` HS teams, `13` county programs, `26` ColdRush, `8` Caps clinics | hockey |
| `36` Private, `33` Off Ice, `b` Block, `r` Rental, `L` Locker Room, "Virtual Testing", "Coaches' Daily Registration" | hidden |

Plain titles ("Public Skate evening Nov", "Freestyle- Weekdays", "Stick n Shoot-Afternoon",
"Adult Pickup Hockey (18+) - Evening") are blanked; variants (Recess, Adult Swim, Senior Skate,
Hybrid Freestyle, Mini Stick n Shoot) are kept as the title. Drop-ins carry the league's
rules blurb as the subtitle and `registerUrl` pointing at the DASH checkout.

## Repeat times (Nov to mid-Dec 2026, from the feed; Arlington Rink unless noted)

| Day | Session | Time |
|---|---|---|
| Mon | Arlington County Senior Skate ($1) | 8:40 to 9:50am |
| Tue | Public skate | 4:30 to 5:20pm |
| Sun | Recess (public skate for children aged 2 to 10; shown under Kids & family skate) | 1:50 to 2:50pm |
| Sun | Public skate | 3:00 to 4:00pm |
| Sun | Hybrid freestyle | 6:30 to 8:00pm |
| Mon to Fri | Freestyle (30-min slots, merged on the site) | daytime |
| Tue | Adult Learn to Play (Capitals Rink) | 9:10 to 10:20pm |

Public skates are published a few weeks ahead and vary with the Capitals' practice schedule;
stick n shoot and pickup hockey appear week by week. Check the live list.

## Costs (DASH `products` catalog, 2026-10-31; indicative, the checkout is authoritative)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Public skate, general | admission | 1 | $15 | $15 |
| Public skate, adult / 12 and under / holiday | admission | 1 | $9 / $8 / $10 | |
| Freestyle | session | 1 | $10 | $10 |
| Stick n Shoot (and Mini) | session | 1 | $20 | $20 |
| Pickup hockey 18+ (goalies free) | session | 1 | $20 | $20 |
| Arlington Senior Skate / $1 Skate | admission | 1 | $1 | $1 |
| Learn to Skate class | class | 1 | $23 to $26 | |

Sales are non-refundable. Register before coming; the homepage says to check DASH first.

## Gotchas

- Freestyle league id changes monthly; public/stick/pickup leagues are per season. Resolve
  through `include=league` and `sport_id`, never by league id.
- Many parallel class rows (eight "Basic N- Sunday 4:15pm" rows at once) under Lessons.
- A legacy MaxGalaxy link on the homepage is dead.
- Street address is not printed on the site; it matches the facility lat/lng in DASH.

## Samples

`samples/events-sample.json` (three published drop-ins with summary, resource and league),
`samples/sports.json`, `samples/resources.json`, `samples/event-types.json`, `samples/leagues_current.json`.
