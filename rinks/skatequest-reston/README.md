# SkateQuest (Reston)

| | |
|---|---|
| Address | 1800 Michael Faraday Ct, Reston, VA 20190 |
| Phone | (703) 709-1010 |
| Website | https://www.skatequest.com (Duda site) |
| Public calendar | https://apps.daysmartrecreation.com/dash/x/#/online/skatequest/calendar |
| Prices page | https://www.skatequest.com/public-events |
| Sheets | NHL Rink (resource 1), Olympic Rink (resource 2) |
| Online pre-pay | none for public skate, freestyle or drop-in hockey (walk-up); lessons register online |

Checked 2026-10-31.

## Where the schedule comes from

DaySmart Recreation ("DASH"), company slug **`skatequest`**. The site's /calendar page
embeds the DASH widget (`apps.daysmartrecreation.com/dash/index.php?Action=WidgetJS/index&company=skatequest`).

```
GET https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/events
    ?company=skatequest
    &filter[start__gte]=2026-10-31T00:00:00&filter[start__lte]=2026-11-14T23:59:59
    &filter[publish]=1&filter[resource_id__in]=1,2
    &filter[event_type_id__in]=8,16,25,26,21,24,23,10,17,18,11,13,27,7,19,9,15,22,12,c,g,k
    &include=summary,resource&page[size]=500&sort=start
```

Four weeks of sheet sessions is about 530 rows (freestyle is booked as back-to-back 30-minute
slots; the frontend merges them, so a Monday shows as one 5:40am to 11:20am freestyle block
instead of twelve rows). CORS echoes any origin.

### Classification (by `event_type_id`)

| id | DASH name | Category |
|---|---|---|
| 8 | Public Skate | public_skate |
| 16, 25, 26 | Freestyle, Low Freestyle, High Freestyle | freestyle |
| 21, 24, 23 | High Stroking, Low Stroking, Dance Ice | freestyle |
| 10 | Adult Pick-Up Hockey | pickup_hockey |
| 17 | Stick & Shoot | stick_and_puck (priced, rarely scheduled) |
| 18, 11, c | LTS, LTS Practice Time, Class | learn_to_skate |
| 13, 27, 7, 19, 9, g | Hockey Lesson Ice, Hockey Camp, Reston Raiders, NVSHL game, Tournament, Game | hockey |
| 15 | Ice Show | figure_skating |
| 22, 12, k | Special Event, Fundraiser, Camp | other |
| 14, 20, 28, 29, b, r, L | Ice Maintenance, Party, Party Booking, Private Ice, Block, Rental, Locker Room | hidden |

## Repeat times (Nov to mid-Dec 2026, from the feed; matches the website)

| Day | Session | Sheet | Time |
|---|---|---|---|
| Mon, Tue, Thu | Adult pick-up hockey | NHL | 11:40am to 1:00pm |
| Wed, Fri | Public skate | NHL | 11:40am to 1:00pm |
| Fri | Public skate | NHL | 7:30 to 9:30pm |
| Sat | Public skate | NHL | 1:10 to 3:00pm |
| Sun | Public skate | NHL | 3:10 to 5:10pm |
| Mon to Fri | Freestyle | NHL then Olympic | from 5:40am, most of the day |
| Mon | LTS practice | NHL | 3:30 to 5:00pm |

## Costs (public-events page, 2026-10-31)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Public skate | admission | 1 | $10.00 | $10.00 |
| Skate rental | pair | 1 | $4.00 | $4.00 |
| Freestyle | session | 1 | $8.75 | $8.75 |
| Stroking | session | 1 | $13.00 | $13.00 |
| Off-ice | session | 1 | $15.00 | $15.00 |
| Adult pick-up hockey | session | 1 | $15.00 | $15.00 |
| Stick & Shoot | session | 1 | $15.00 | $15.00 |

DASH `programs` shows Public Skate with `allow_event_registration: false` and every public,
freestyle and pick-up event has `register_capacity: 0`, so sessions are not sold per event
online. Learn to Skate and figure skating programs do register online at
https://apps.daysmartrecreation.com/dash/x/#/online/skatequest/programs.

## Gotchas

- 127 of 369 rows in an unfiltered week are locker-room assignments; always filter the resources.
- "Freestyle" summary names sometimes carry a trailing space.
- Reston Raiders club ice (type 7) is unpublished and dropped by the publish filter.

## Samples

`samples/events-sample.json`, `samples/event-types.json`, `samples/resources.json`
(financial fields removed).
