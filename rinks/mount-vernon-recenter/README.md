# Mount Vernon RECenter Ice Arena (Alexandria)

| | |
|---|---|
| Address | 2017 Belle View Blvd, Alexandria, VA 22307 |
| Phone | (703) 768-3224 |
| Website | https://www.fairfaxcounty.gov/parks/recenter/mount-vernon/ice-arena |
| Sheets | Red Rink (R) and Blue Rink (B), both NHL size (reopened June 2025) |
| Online pre-pay | yes, Fairfax County Park Authority "Parktakes" ticket store (US eDirect) |
| Ticket store | https://fairfax.usedirect.com/FairfaxFCPAWeb/ACTIVITIES/Search.aspx?category_name=ice%20tickets&place_id=7949 |

Checked 2026-10-31.

## Where the schedule comes from

There is **no JSON or ICS feed**. Two public sources:

1. **Ticket store HTML (used by the adapter).** The eDirect search page is server-rendered,
   one `<tr>` per ticketed session:

   ```
   GET https://fairfax.usedirect.com/FairfaxFCPAWeb/ACTIVITIES/Search.aspx
       ?category_name=ICE%20TICKETS&place_id=7949&search_text=public        (also: stick%20and%20puck, pickup%20hockey)
   ```

   Cells: `data-label="Session"` ("PS 10:45 AM", "Adult PS 7:00 PM", "SNP ...", "PUH ..."),
   `Schedule` ("Sat, 11/07/2026 10:45 AM - 12:00 PM", local time), `Restrictions` (ages),
   `Seats`, and a `Details.aspx?session_id=` link with prices. 50 rows per activity per page;
   page 2 needs an ASP.NET postback (POST), so only about the next month is reachable
   read-only. Complete for Stick and Puck and Pickup Hockey; **public skate is a subset**
   (weekday-morning door-only sessions are missing); freestyle and ice dance return nothing.
   No sheet (Red/Blue) in the listing. No CORS; fetched server-side.

2. **County PDF calendars (complete, not parsed yet).** Stable URLs, replaced in place each
   month (current and next month on two pages):

   ```
   https://www.fairfaxcounty.gov/parks/sites/parks/files/Assets/documents/recenters/calendars/mvice.pdf          public sessions
   .../mvfreestyle.pdf   freestyle        .../mvice-hockey.pdf   PUH + SNP        .../mvice-dance.pdf   ice dance
   ```

   `pdftotext -layout` extracts a 7-column month grid of `H:MM-H:MM am/pm (R|B)` cells;
   `*...*` marks adult-only (14+). Parsing it needs column offsets and is the way to get the
   full public schedule, the sheet, and freestyle. See the research notes in git history
   (scratchpad findings) before attempting it.

### Classification

| Session code | Category | Title |
|---|---|---|
| PS | public_skate | |
| Adult PS (restriction 14 to 99) | public_skate | Adults only (14+) |
| SNP | stick_and_puck | |
| PUH | pickup_hockey | |

Capacity is the Seats cell; `registerUrl` is the session's Details page.

## Repeat times (Nov to mid-Dec 2026, from the ticket store; door-only mornings not included)

| Day | Session | Time |
|---|---|---|
| Mon to Fri | Stick and Puck | 5:15 or 5:30 to 7:00am |
| Tue, Thu | Stick and Puck | 9:30 to 11:00am |
| Mon, Wed | Stick and Puck | 2:00 to 3:30pm / 4:15 to 5:45pm |
| Mon, Wed, Fri | Pickup hockey | 11:30am to 1:00pm (Wed 12:15 to 1:45pm) |
| Mon | Public skate | 3:15 to 5:15pm; adults-only 7:00 to 8:30pm |
| Tue | Public skate | 12:15 to 2:15pm, 2:30 to 4:30pm |
| Wed | Public skate | 2:30 to 4:00pm |
| Thu | Public skate | 10:00am to 12:00pm, 3:15 to 5:15pm |
| Fri | Public skate | 2:15 to 4:15pm |
| Sat | Public skate | 10:45am to 12:00pm, 12:15 to 2:00pm; Stick and Puck 9:00 to 10:30am |
| Sun | Public skate | 12:00 to 2:00pm, 2:15 to 3:45pm; Stick and Puck 1:00 to 2:30pm |

## Costs (county page, Oct 2026; public skate includes rental)

| Item | Unit | Sessions | Price | Per session |
|---|---|---|---|---|
| Public skate, child 4 and under | admission | 1 | $4 | $4 |
| Public skate, youth 5 to 18 / senior 65+ | admission | 1 | $10 | $10 |
| Public skate, adult 19+ | admission | 1 | $14 | $14 |
| Public skate, family (up to 5) | admission | 1 | $40 | $8 |
| Public skate discount book, youth/senior | 10 visits (no rental) | 10 | $54 | $5.40 |
| Public skate discount book, adult | 10 visits (no rental) | 10 | $90 | $9 |
| Public skate discount book, youth/senior / adult | 25 visits | 25 | $127.50 / $212.50 | $5.10 / $8.50 |
| Stick and Puck, Pickup Hockey, Ice Dance | session | 1 | $17 | $17 |
| Specialty session pass | 10 visits | 10 | $153 | $15.30 |
| Freestyle | session | 1 | $9 | $9 |
| Freestyle pass | 10 / 25 visits | 10 / 25 | $81 / $191.50 | $8.10 / $7.66 |
| Skate rental | pair | 1 | $4 | $4 |

RECenter members skate free. The PDF footer prints stale prices; the web page is current.

## Gotchas

- Ticket listing rows are only sessions sold online; cross-check the PDF for the full picture.
- The store sets session cookies and a `Refresh` header to a logout page; ignore both.
- Date query parameters on the search page are ignored; the adapter filters client-side.

## Samples

`samples/usedirect-search-sample.html`: four rows from each of the three listings.
