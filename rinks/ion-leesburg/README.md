# ION International Training Center (Leesburg)

| | |
|---|---|
| Address | 19201 Compass Creek Pkwy, Leesburg, VA 20175 |
| Public website | https://www.ionitc.com (Wix) |
| Schedule page | https://www.ionitc.com/iceschedule |
| Schedule vendor | Custom widget at `schedule.ionitc.com` (Python aiohttp), fed from FinnlyConnect |
| Registration vendor | FinnlyConnect, `https://ionitc.finnlyconnect.com` |
| Timezone | America/New_York |
| Verified | 2026-10-31 |

## Summary

ionitc.com is a Wix site. The "Ice Schedule" page embeds an iframe titled
"Daily Ice Schedule" pointing at `https://schedule.ionitc.com/`, a small custom app
that polls its own `/api/schedule` endpoint every 30 seconds. That endpoint is
**open, no login, plain JSON**, but **sends no CORS headers**, so a browser on
another origin cannot call it; a server-side proxy or scheduled fetch is required.

The facility's actual booking system is FinnlyConnect. Its public "Rinks" page
embeds roughly five weeks of events as JSON in the HTML, with more fields than the
widget exposes (stable event ids, internal notes, resurface windows).

## Ice surfaces

| Widget name | FinnlyConnect id | FinnlyConnect name |
|-------------|------------------|--------------------|
| Arena | 3513 | Arena |
| Ion Rink | 3512 | ION Rink (trailing space in the data) |

## Endpoints

### 1. Schedule widget API (simplest)

```
GET https://schedule.ionitc.com/api/schedule?startDate=2026-10-31&daysAhead=14
```

| Param | Meaning |
|-------|---------|
| `startDate` | `YYYY-MM-DD`, local date |
| `daysAhead` | number of days after `startDate` to include (returns `daysAhead + 1` keys) |

Response: an object keyed by date, each value an array of events in start order.

```json
{
  "2026-11-01": [
    {
      "ts": "07:00",
      "te": "07:30",
      "title": "Freestyle/Dance",
      "desc": "",
      "type": "Freestyle/Dance",
      "style": "#ff000c",
      "rink": "Ion Rink",
      "locker": []
    },
    {
      "ts": "09:00",
      "te": "10:30",
      "title": "LKHC 12U Wales vs. Caps Academy (CBHL)",
      "desc": "LKHC Game",
      "type": "Loudoun Knights Hockey Club",
      "style": "#febf04",
      "rink": "Arena",
      "locker": [
        {"tenant": "Caps Academy", "room": "LR 6 & 7", "home": false},
        {"tenant": "LKHC 12U Wales", "room": "LKHC ", "home": true}
      ]
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `ts`, `te` | start and end, `HH:MM` 24-hour local |
| `title` | public name; for drop-in sessions this equals `type` |
| `desc` | optional second line |
| `type` | category label, see below |
| `style` | hex colour for the type badge |
| `rink` | `Arena` or `Ion Rink` |
| `locker` | locker-room assignments, empty for public sessions |

There is no event id. Dedupe on `(date, ts, te, rink, title)`.

The widget page itself accepts `?zoom=<px>`, `?daysAhead=<n>`, `?scroll=<seconds>`
and `?showPastEvents` if you ever want to embed it as-is.

Sample: `samples/widget-2026-10-31.json`.

### 2. FinnlyConnect facility schedule (richer, embedded in HTML)

```
GET https://ionitc.finnlyconnect.com/schedule/795
```

An ~800 KB HTML page. Inside a `<script>` is a JSON array of event objects
(search for `{"EventId":`). On 2026-10-31 it held 913 events from 2026-10-24 to
2026-11-30. No separate JSON endpoint was found; the page is server-rendered.

Event object fields:

| Field | Meaning |
|-------|---------|
| `EventId` | stable integer id |
| `FacilityId`, `FacilityName` | 3512 ION Rink, 3513 Arena |
| `EventStartTime`, `EventEndTime` | ice time, local, no offset |
| `BlockStartTime`, `BlockEndTime` | ice time plus resurface windows |
| `MaintenanceBefore/After...` | 10-minute resurface slots |
| `EventTypeId`, `EventTypeName` | category (10888 Public Skate, 11412 Freestyle/Dance, ...) |
| `AccountName` | who booked it (Public Skate, LKHC, WLC, ...) |
| `Description`, `ScheduleNotes` | public blurb and internal note ("LKHC 8U Practice") |
| `BackgroundColor`, `TextColor` | 8-digit hex (RRGGBBAA) |
| `Closed` | event cancelled/closed |
| `ShowAccount`, `ShowEventNotes`, `ShowScheduleNotes` | what the public display is allowed to show; honour these |
| `start`, `end`, `title` | Kendo scheduler copies; `title` is just the time range |

Sample: `samples/finnlyconnect-events-sample.json`.

### 3. FinnlyConnect registration pages

```
GET https://ionitc.finnlyconnect.com/registration/activitylist
GET https://ionitc.finnlyconnect.com/registration/activityitemv2/<ActivityId>
```

The activity list page embeds a JSON array of purchasable activities (keys such as
`ActivityId`, `Name`, `RegistrationOpen`, `OnlinePurchaseStartDate`, `MaxEnroll`).
On 2026-10-31 it contained only two: "Learn To Curl" (25087) and
"Learn to Skate - Session 6 - 2026" (47064). Learn to Skate sessions 5/2026 (32558)
and 1/2027 (49613) are linked from ionitc.com directly.

## Session categories

`type` values seen over 14 days (counts in parentheses):

| `type` | Category | Count |
|--------|----------|-------|
| Public Skate | public_skate | 5 |
| Freestyle/Dance, Freestyle | freestyle | 135 |
| Pick-Up Hockey | pickup_hockey | 9 |
| Adult Hockey, Adult Hockey 40+, Adult League | pickup_hockey / league | 10 |
| Learn To Skate, Learn to Skate | learn_to_skate | 7 |
| Loudoun Knights Hockey Club, WLC, NVSHL, TPH/23 Hockey, Academy TPH, My Hockey Tournament | game / practice | ~210 |
| Dance Academy, Developmental Academy, Future Champs & Ice Prodigies, Ashburn Synchronized Skating | figure skating programs | 21 |
| Curling League | other | 2 |
| Facility | other | 1 |

Freestyle sessions are 30-minute blocks back to back; merge adjacent ones for display.

## What the feeds show that the website does not

The widget shows essentially everything it receives. The FinnlyConnect page adds:

- stable `EventId` values
- internal `ScheduleNotes` labels
- resurface windows before and after each event
- the `Closed` flag
- "Ice Rental" blocks (68 in five weeks) that the widget omits
- display-permission flags (`ShowAccount` etc.)

Nothing personal about registrants is exposed by either.

## Regular public skate times

Derived from `/api/schedule` for 2026-11-02 through 2026-12-13 (six weeks). ION
publishes public skates week by week rather than on a fixed template, so only the
weekend slots are dependable.

| Day | Time | Rink | Weeks seen (of 6) |
|-----|------|------|-------------------|
| Sat | 14:10-15:40 | Ion Rink | 4 (one week ran 14:10-15:10) |
| Sun | 14:10-15:40 | Ion Rink | 4 |
| Mon-Wed | 12:30-14:30 | Ion Rink | 1 each; Nov 2, 3, 25 (Nov 9 was 13:00-14:00) |
| Fri | 17:00-20:00 or 19:20-21:20 | Ion Rink / Arena | 2 (Nov 13, Dec 4) |
| Fri (holiday) | 12:00-14:00 | Arena | 1 (Nov 27, Thanksgiving) |

Every public skate occurrence in the sample:

```
Mon 2026-11-02 12:30-14:30 Ion Rink      Sat 2026-11-21 14:10-15:40 Ion Rink
Tue 2026-11-03 12:30-14:30 Ion Rink      Wed 2026-11-25 12:30-14:30 Ion Rink
Mon 2026-11-09 13:00-14:00 Ion Rink      Fri 2026-11-27 12:00-14:00 Arena
Fri 2026-11-13 19:20-21:20 Arena         Sat 2026-11-28 14:10-15:40 Ion Rink
Sat 2026-11-14 14:10-15:10 Ion Rink      Sun 2026-11-29 14:10-15:40 Ion Rink
Sun 2026-11-15 14:10-15:40 Ion Rink      Fri 2026-12-04 17:00-20:00 Ion Rink
                                         Sun 2026-12-06 14:10-15:40 Ion Rink
                                         Sat 2026-12-12 14:10-15:40 Ion Rink
                                         Sun 2026-12-13 14:10-15:40 Ion Rink
```

Other consistent drop-ins:

| Session | Day | Time | Rink | Weeks seen |
|---------|-----|------|------|------------|
| Pick-Up Hockey | Mon-Fri | 12:00-13:00 | Arena | 4-6 |
| Adult Hockey 40+ | Sun | 07:00-08:00 | Arena | 5 |
| Adult Hockey | Sun | 20:20-21:40 | Arena | 4 |
| Adult League | Wed, Thu | 22:10-23:50 | both | 4-5 |
| Learn To Skate | Mon 16:30-17:30, Wed 13:00-14:00, Sat 12:30-14:00 | | Ion Rink | 4-10 |
| Freestyle/Dance | Mon-Fri | mornings and afternoons, 30-min blocks | Arena | 50-78 blocks/day-of-week |
| Freestyle/Dance | Sat, Sun | 30-min blocks | Ion Rink | 20-40 blocks/day-of-week |

## Costs

Published on ionitc.com/skatingprograms (2026-10-31). This is the complete list of
publicly priced items; everything else is behind the FinnlyConnect login or at the
front desk.

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public skate, adults (ages 13+) | admission, skate rental included | 1 | $20.00 | $20.00 |
| Public skate, kids (ages 12 and under) | admission, skate rental included | 1 | $17.00 | $17.00 |
| Freestyle/Dance | not published | | | |
| Pick-Up Hockey, Adult Hockey, Adult League | not published | | | |
| Learn to Skate | priced per session inside FinnlyConnect activity pages | | | |
| Multi-session passes | not published online | | | |

The page advises arriving 15-20 minutes early and warns sessions may sell out.

## Passes and pre-payment

Account pages that exist publicly:

- Create account: `https://ionitc.finnlyconnect.com/Account/CreateAccount`
- Log in: `https://ionitc.finnlyconnect.com/Login`

**Checked inside a logged-in FinnlyConnect account on 2026-10-31.** There is still
nothing to buy for public skate or freestyle:

- Account page tiles: Memberships ("There are no Memberships"), Subscriptions (empty),
  Open Invoices, Open Transactions, Payments/Receipts, Waivers, Assessment,
  Registrations, Group Registrations, Create Payment Account.
- Menu: Register has only "Activity", which lists Learn to Skate and Learn to Curl.
  No store, cart page, passes, or punch cards anywhere.
- Rinks schedule (`/schedule/795`): clicking a session opens an info popup with date,
  account name, and location only. No register or pay button.

Conclusion: public skate at ION is paid at the front desk. Whatever multi-session
discount staff describe is not sold online as of this date. The "Walk-in info" button
on ION cards links to the prices page.

Staff say multi-session passes can be bought online. As of 2026-10-31 **nothing of
the kind is visible without logging in**: FinnlyConnect's public activity list sells
only Learn to Skate and Learn to Curl, and the site map has no store, pass, or
membership page. Possibilities: passes are front-desk only, or they appear under a
Passes/Memberships menu inside a logged-in FinnlyConnect account. Check with an
account. No purchase endpoint was attempted.

## Gotchas

- `schedule.ionitc.com` has no CORS headers; call it from a server.
- `FacilityName` for the ION Rink has a trailing space.
- Widget `title` for drop-ins duplicates `type`; hockey rows put the matchup in `title`.
- FinnlyConnect colours are RRGGBBAA; drop the last two characters for CSS.
- The FinnlyConnect page is large and server-rendered; fetch it a few times a day, not per request.

## Adapter

`adapter.js` in this folder fetches `/api/schedule` for the requested date range and
normalises it. `classify(type, title)` maps the widget's `type` to the shared
categories. Tests: `test/adapters.test.js` against `samples/widget-2026-10-31.json`.

## Samples

- `samples/widget-2026-10-31.json` — `/api/schedule?startDate=2026-10-31&daysAhead=3`, full response
- `samples/finnlyconnect-events-sample.json` — first 25 events parsed from `/schedule/795` on 2026-10-31
