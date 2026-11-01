# Prince William Ice Center (Dale City / Woodbridge)

| | |
|---|---|
| Address | 5180 Dale Blvd, Woodbridge, VA 22193 |
| Phone | (703) 730-8423 |
| Website | https://www.innovativesportsva.com (SportsEngine). `pwice.com` is now a squatted affiliate site; do not link it. |
| Schedule app | https://pwice.frontline-connect.com/scheduleselect.cfm?fac=pwice&facid=1 |
| Prices page | https://www.innovativesportsva.com/page/show/8780814-public-skate |
| Sheets | NHL, Olympic |
| Online pre-pay | none for regular sessions (pay at the door); only specials are sold at the Frontline store |

Checked 2026-10-31.

## Where the schedule comes from

**Frontline Connect**, a ColdFusion rink scheduler. No JSON, no ICS, no CORS. The monthly
page is GET-addressable per session type and is what the adapter reads:

```
GET https://pwice.frontline-connect.com/monthlysched.cfm?fac=pwice&facid=1&session=1&month=11&year=2026
```

| `session` | Type | Category |
|---|---|---|
| 1 | Public Session (Open Skate) | public_skate |
| 3 | Stick-n-Shoot | stick_and_puck |
| 4 | Freestyle | freestyle |
| 2 | Pickup Hockey | pickup_hockey (empty at the moment) |
| 5 to 8 | other hockey programs | empty |

One `<td>` per day: `<span id="spandtN">Nov 01 2026</span>`, then `div.surfdiv > strong`
(NHL or OLYMPIC) followed by `div.sessdiv` lines like `4:30 PM - 5:50 PM` (the responsive
markup repeats each value three times; only `surfdiv`/`sessdiv` are read). Times are local.
The current month returns today and later only; Nov 2026 to Jan 2027 were populated
(about 44 public sessions a month). The adapter fetches each month in the window for each
of the four types, so a 35-day window is 8 requests to a small IIS server.

`dailysched.cfm?fac=pwice&facid=1` lists everything happening today by name (lessons,
leagues, specials such as "Spooky Skate"), but other dates need a POST, so it is not used.
Lessons and leagues are therefore not shown for this rink.

## Repeat times (Nov 2026, from the monthly pages)

Public sessions run most days on one sheet or the other, typically late morning
(11:50am to 1:10pm) on weekdays and afternoons on weekends (12:10 to 1:30pm and 4:30 to
5:50pm). Stick-n-Shoot appears about nine times a week. Freestyle runs daily in morning and
midday blocks on both sheets. See the live list; the pattern changes month to month.

## Costs (public-skate page, 2026-10-31)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Public skate | admission | 1 | $10 | $10 |
| Skate rental | pair | 1 | $5 | $5 |
| Skate aid | rental | 1 | $10 | $10 |
| Freestyle | hour | 1 | $14 | $14 |
| Stick-n-Shoot | session | 1 | $17 | $17 |

## Gotchas

- Print links on the schedule pages return PDFs; the monthly HTML is what to parse.
- Poll gently: one small server.
- The address is not on any first-party page; it comes from directories.

## Samples

`samples/monthly-public-2026-11.html` and `samples/monthly-stick-2026-11.html`: the
schedule table from the real November pages.
