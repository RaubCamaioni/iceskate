# Northern Virginia Ice Rink Schedules

One page that pulls every ice rink's schedule straight from the system that stores it
and shows a single merged event list. The rinks' own websites are hard to use; this
replaces them for the question "when can I skate, and where?"

Each rink lives in its own folder under `rinks/` with research notes, sample API
responses, and the adapter that fetches and normalises its feed. Add a folder to add
a rink.

| Rink | Location | Schedule backend | Direct JSON? | Folder |
|------|----------|------------------|--------------|--------|
| Ashburn Ice House | Ashburn, VA | DaySmart Recreation ("DASH") | Yes, open JSON:API, CORS enabled | [`rinks/ashburn-ice-house/`](rinks/ashburn-ice-house/README.md) |
| ION International Training Center | Leesburg, VA | Custom widget + FinnlyConnect | Yes, open JSON, no CORS | [`rinks/ion-leesburg/`](rinks/ion-leesburg/README.md) |
| Loudoun Ice Centre | Sterling, VA | Wix site + public Google Calendar | ICS feed, no CORS | [`rinks/loudoun-ice-centre/`](rinks/loudoun-ice-centre/README.md) |
| Haymarket IcePlex | Haymarket, VA | DaySmart Recreation | Yes, open JSON:API, CORS enabled | [`rinks/haymarket-iceplex/`](rinks/haymarket-iceplex/README.md) |
| SkateQuest | Reston, VA | DaySmart Recreation | Yes, open JSON:API, CORS enabled | [`rinks/skatequest-reston/`](rinks/skatequest-reston/README.md) |
| MedStar Capitals Iceplex | Arlington, VA | DaySmart Recreation | Yes, open JSON:API, CORS enabled | [`rinks/medstar-capitals-iceplex/`](rinks/medstar-capitals-iceplex/README.md) |
| Fairfax Ice Arena | Fairfax, VA | DaySmart Recreation (+ Mindbody for freestyle) | Yes for DASH; Mindbody is HTML | [`rinks/fairfax-ice-arena/`](rinks/fairfax-ice-arena/README.md) |
| Mount Vernon RECenter | Alexandria, VA | Fairfax County PDF calendars + ticket store (US eDirect) | No, PDF grids parsed with pdfjs | [`rinks/mount-vernon-recenter/`](rinks/mount-vernon-recenter/README.md) |
| Prince William Ice Center | Dale City, VA | Frontline Connect | No, HTML monthly pages | [`rinks/prince-william-ice-center/`](rinks/prince-william-ice-center/README.md) |
| The St. James | Springfield, VA | own platform (hub.thestjames.com) | private API, not integrated | see "Not integrated" below |

Every indoor rink in Northern Virginia within about 50 miles of Leesburg. Findings verified live on 2026-10-31. Endpoints can change without notice.

## Running the site

Requires Node 18 or newer. One dependency (`pdfjs-dist`, which reads Mount Vernon's
PDF calendars).

```
npm install
npm start
```

Then open http://localhost:3000. The page merges everything into one list, grouped by
day, with rink and session-type filters, a date range, and a hide-finished toggle.
Rinks sort by driving time from a starting point, shown on each rink row and on every
session card. The default starting point is Leesburg, VA (`DEFAULT_ORIGIN` in
`public/app.js`); "Use my location" or a typed address or zip replaces it. "Show map" reveals a
Leaflet map (OpenStreetMap tiles, loaded from cdnjs) with every rink as a marker in its
colour; a marker's popup has the drive time, directions, phone, website and a switch for
its sessions. Geocoding uses
Nominatim and routing uses the public OSRM demo router, both OpenStreetMap services;
if routing is unavailable the page falls back to straight-line distance. Each rink's
coordinates live in its adapter (`lat`, `lng`).
It is a single list on purpose: it works the same on a phone as on a desktop.

### How caching works

The server keeps a rolling window of events (7 days back through 35 days ahead, so
the current week is always covered) for every rink in memory and serves `/api/events?from=YYYY-MM-DD&to=YYYY-MM-DD` straight from
it, so requests never wait on a rink. The window is re-fetched in the background
every hour. A refresh that fails for one rink keeps that rink's previous data and
flags it as stale in the response. After each refresh a snapshot is written to
`.cache/events-snapshot.json` so a restart serves immediately while the first
refresh runs. Ranges outside the window are fetched on demand and cached for ten
minutes. `/api/status` shows the window, last fetch time per rink, and any errors.

| Environment variable | Default | Meaning |
|----------------------|---------|---------|
| `PORT` | 3000 | listen port |
| `CACHE_REFRESH_MS` | 3600000 (1 h) | background refresh interval |
| `CACHE_HORIZON_DAYS` | 35 | days ahead kept warm |
| `CACHE_PAST_DAYS` | 7 | days back kept warm |
| `CACHE_TTL_MS` | 600000 (10 min) | cache for out-of-window on-demand ranges |

```
npm test
```

runs the adapter tests against the sample responses in each rink folder.

## Hosting for free on GitHub Pages

The site does not need the Node server to be running anywhere. A GitHub Actions
workflow (`.github/workflows/publish.yml`) runs every morning at 09:00 UTC
(5am EDT / 4am EST), on every push to `main`, and on demand from the Actions tab:

1. `npm test`
2. `node scripts/build-static.js` fetches every rink for today through 35 days ahead
   and writes `public/data/schedule.json` in the same shape `/api/events` returns.
   A rink that fails keeps its events from the previously published snapshot (read
   from the live site) and is flagged stale on the page; the build fails only if
   every rink fails.
3. `public/` is uploaded and deployed to GitHub Pages.

The frontend asks for `api/events` first; when that is missing (a static host) it
loads `data/schedule.json` and filters it to the chosen range. The status line then
says when the data was synced and that it is re-synced every morning. Asset URLs are
relative so the site works from a project sub-path such as `user.github.io/iceskate/`
or from a custom domain.

One-time setup: push the repo to GitHub, then in **Settings > Pages** set the source
to **GitHub Actions**. The repo must be public for free Pages. Schedules in the rink
systems rarely change within a day, so a daily sync is enough; change the `cron` line
to sync more often. Note that GitHub pauses scheduled workflows in a repo with no
commits for 60 days; a manual run from the Actions tab resumes them.

## Repository layout

```
README.md                      this file
package.json                   npm start / npm test, no dependencies
server/server.js               HTTP server: static files + /api/events, discovers rinks/*/adapter.js
public/                        the web page (index.html, app.js, style.css)
public/data/schedule.json      generated by the daily build for static hosting (gitignored)
scripts/build-static.js        fetches every rink and writes public/data/schedule.json
.github/workflows/publish.yml  daily GitHub Pages build + deploy
test/                          adapter tests, run with node --test
rinks/
  _template/                   copy this folder when adding a rink
    README.md
    adapter.js
  ashburn-ice-house/
    README.md                  findings, endpoints, field notes, repeat times, costs
    adapter.js                 fetch + normalise for this rink
    samples/                   trimmed real API responses
  ion-leesburg/
    README.md
    adapter.js
    samples/
  loudoun-ice-centre/          Google Calendar ICS
  haymarket-iceplex/           DaySmart
  skatequest-reston/           DaySmart
  medstar-capitals-iceplex/    DaySmart (league-based classification)
  fairfax-ice-arena/           DaySmart
  mount-vernon-recenter/       county ticket-store HTML
  prince-william-ice-center/   Frontline Connect HTML
  mount-vernon-recenter/pdf.js PDF month-grid parser (pdfjs)
lib/daysmart.js                shared DaySmart JSON:API client (five rinks use it)
lib/ics.js                     iCalendar parser + recurrence expander
```

## Normalised event shape

Every adapter returns events in this shape so the page never needs rink-specific code.

| Field | Type | Notes |
|-------|------|-------|
| `rink` | string | folder slug, e.g. `ashburn-ice-house` |
| `rinkName` | string | display name |
| `sheet` | string | ice surface as the rink names it |
| `sourceId` | string or null | vendor's event id when it has one |
| `start`, `end` | `YYYY-MM-DDTHH:MM:SS` | local wall-clock, America/New_York |
| `title` | string | public session name; empty when it would only repeat the category (e.g. ION "Freestyle/Dance") |
| `subtitle` | string | optional second line |
| `category` | enum | `public_skate`, `freestyle`, `stick_and_puck`, `pickup_hockey`, `learn_to_skate`, `hockey`, `figure_skating`, `other` |
| `capacity` | int or null | only Ashburn exposes this |
| `color` | string or null | vendor's colour for the session type |
| `registerUrl` | string or null | where to sign up or pay |

---

## Ashburn Ice House

| | |
|---|---|
| Address | 21595 Smith Switch Rd, Ashburn, VA 20147 |
| Phone | (703) 858-0300 |
| Ice sheets | East Rink, West Rink, Outdoor Rink (seasonal) |
| Register / pay | https://apps.daysmartrecreation.com/dash/x/#/online/ashburn/event-registration |

### Repeat times

From six weeks of live data (2026-11-02 to 2026-12-13); a slot is listed when it
appeared in three or more weeks. All on West Rink unless noted. Holiday weeks add
sessions and shift times, so the live page is the source of truth.

| Day | Public skate | Playground on Ice (ages 2-8) | Freestyle | Stick n Shoot / Pick-up |
|-----|--------------|------------------------------|-----------|-------------------------|
| Mon | 10:30-11:30 am, 3:50-4:50 pm | 9:20-10:20 am | East Rink 5:30 am-5:10 pm, 30-min blocks | SnS 8:00-9:00 am, 12:00-1:30 pm, 3:10-4:30 pm |
| Tue | 10:30-11:30 am | occasional | East Rink 5:30 am-5:50 pm | SnS 12:00-1:30 pm |
| Wed | 2:00-3:00 pm | 10:30-11:30 am | East Rink 5:30 am-4:50 pm | SnS 6:00-8:00 am; Adult pick-up 12:00-1:30 pm |
| Thu | 12:00-1:30 pm, 4:50-5:50 pm | none | East Rink 5:30 am-5:20 pm | SnS 10:30-11:40 am |
| Fri | 10:30-11:30 am, 8:10-9:10 pm "Friday Rockin' Skate" | 9:20-10:20 am | East Rink 5:30 am-5:50 pm | Adult pick-up 8:10-9:10 am, 12:10-1:40 pm |
| Sat | 12:50-1:50 pm, 4:10-5:10 pm | 9:40-10:30 am | none regular | none regular |
| Sun | 2:00-3:00 pm | 9:40-10:40 am (East Rink) | West Rink 10:10-11:40 am | none regular |

### Costs

Prices come from the DaySmart product catalogue, which is what its checkout charges
(2026-10-31). Admission does not include skate rental unless stated.

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public Skate, general | admission | 1 | $15.00 | $15.00 |
| Public Skate, child | admission | 1 | $8.00 | $8.00 |
| Public Skate, senior | admission | 1 | $5.00 | $5.00 |
| Public Skate, group | per person | 1 | $10.00 | $10.00 |
| Skate rental | per pair | 1 | $5.00 | $5.00 |
| Playground on Ice | per child, includes one adult chaperone and both rentals; extra adult $18 | 1 | $18.00 | $18.00 |
| Freestyle | single session | 1 | $10.00 | $10.00 |
| Stick n Shoot | admission | 1 | $20.00 | $20.00 |
| Pick Up Hockey | admission | 1 | $20.00 | $20.00 |
| 11 Session Public Skate Pass | pass | 11 | $72.00 | $6.55 |
| 22 Session Public Skate Pass | pass | 22 | $120.00 | $5.45 |
| Frequent Skater Public Skate Pass | per session, count not published | ? | $12.00 | $12.00 |
| Freestyle Punch Pass 20 | punch pass, priced per punch | 20 | $200.00 | $10.00 |
| Freestyle Punch Pass 40 | punch pass, priced per punch | 40 | $400.00 | $10.00 |
| Freestyle Punch Pass 60 | punch pass, priced per punch | 60 | $600.00 | $10.00 |
| Freestyle Punch Pass 80 | punch pass, priced per punch | 80 | $800.00 | $10.00 |
| Freestyle Punch Pass 100 | punch pass, priced per punch | 100 | $1,000.00 | $10.00 |
| Public Skating Crew Membership | membership, benefits not published | n/a | $50.00 | n/a |

The freestyle punch passes are listed in the catalogue at $10 per punch; the totals
above are sessions times $10 and should be confirmed at checkout. Holiday-deal
variants exist at $10 to $17.50. Product ids are in the rink README.

---

## ION International Training Center (Leesburg)

| | |
|---|---|
| Address | 19201 Compass Creek Pkwy, Leesburg, VA 20175 |
| Phone | (703) 951-0050 |
| Ice sheets | Arena, Ion Rink |
| Register / pay | https://ionitc.finnlyconnect.com (Learn to Skate only online; public skate is pay at the door or in a logged-in account) |

### Repeat times

From six weeks of live data (2026-11-02 to 2026-12-13). ION publishes public skates
week by week rather than on a template; only the weekend slots are dependable. All on
Ion Rink unless noted.

| Day | Public skate | Pick-up / adult hockey (Arena) | Freestyle/Dance | Learn to Skate |
|-----|--------------|-------------------------------|-----------------|----------------|
| Mon | irregular, 12:30-2:30 pm when offered | Pick-Up 12:00-1:00 pm | Arena, mornings and afternoons | 4:30-5:30 pm |
| Tue | irregular, 12:30-2:30 pm when offered | Pick-Up 12:00-1:00 pm | Arena | none |
| Wed | irregular, 12:30-2:30 pm when offered | Pick-Up 12:00-1:00 pm; Adult League 10:10 pm | Arena, some Ion Rink | 1:00-2:00 pm |
| Thu | none seen | Pick-Up 12:00-1:00 pm; Adult League 10:10 pm | Arena | none |
| Fri | irregular evenings, 5:00-8:00 pm or 7:20-9:20 pm (Arena) | Pick-Up 12:00-1:00 pm | Arena | none |
| Sat | 2:10-3:40 pm | none | Ion Rink | 12:30-2:00 pm |
| Sun | 2:10-3:40 pm | Adult Hockey 40+ 7:00-8:00 am; Adult Hockey 8:20-9:40 pm | Ion Rink | none |

Over the six weeks there were 15 public skates, 8 of them Saturday or Sunday 2:10 pm.

### Costs

Published on ionitc.com/skatingprograms (2026-10-31). Nothing else is priced
publicly; freestyle, hockey, and any passes are only visible inside a FinnlyConnect
account or at the front desk.

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public skate, adults (ages 13+) | admission, skate rental included | 1 | $20.00 | $20.00 |
| Public skate, kids (ages 12 and under) | admission, skate rental included | 1 | $17.00 | $17.00 |
| Freestyle/Dance | not published | | | |
| Pick-Up Hockey, Adult Hockey | not published | | | |
| Multi-session passes | not published online | | | |

---

## Loudoun Ice Centre (Sterling)

| | |
|---|---|
| Address | 22149 Davis Dr, Suite 155, Sterling, VA 20164 |
| Phone | (703) 444-0600 |
| Ice sheets | one small studio rink |
| Register / pay | pay at the door; prices at https://www.loudounice.com/public-skating |
| Source | public Google Calendar (ICS feed), expanded by `lib/ics.js` |

### Repeat times

| Day | Session | Time |
|-----|---------|------|
| Tue | Stick & Shoot | 11:30am to 12:50pm |
| Wed, Thu, Fri | Cheap Skate ($6 with rental) | 11:30am to 1:00pm |
| Sat | Public skate | 7:00 to 8:30pm |
| Sat, Sun | Goalie / Player Rookie Program | Sat 3:45pm, Sun 8:30am and 4:20pm |
| Sun | Glow Broomball | 6:35 to 7:35pm |

### Costs

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public skate, child 12 and under | admission | 1 | $8 | $8 |
| Public skate, adult | admission | 1 | $10 | $10 |
| Skate rental | pair | 1 | $5 | $5 |
| Cheap Skate (admission + rental, selected weekdays) | admission | 1 | $6 | $6 |

---

## Haymarket IcePlex

| | |
|---|---|
| Address | 15155 Washington St, Haymarket, VA 20169 |
| Phone | (703) 753-4423 |
| Ice sheets | Rink - North, Rink - South |
| Register / pay | pay at the door; 10-passes through a DASH account; prices at https://www.haymarketiceplex.com/page/show/8611769-pricing |
| Source | DaySmart (`company=haymarketice`) |

### Repeat times

| Day | Session | Sheet | Time |
|-----|---------|-------|------|
| Mon | Stick and Shoot | North | 3:30 to 4:50pm |
| Mon | Public skate | South | 4:30 to 6:00pm |
| Tue, Wed | Stick and Shoot | North | 3:30 to 4:50pm |
| Fri | Public skate | North | 3:30 to 4:50pm |
| Fri | Stick and Shoot | North | 5:00 to 6:20pm |
| Fri | Public skate | South | 7:30 to 8:50pm |
| Sat | Public skate | South | 11:00am to 12:40pm |
| Sat | Public skate | North or South | 6:00 to 7:30pm |
| Sun | Public skate | South | 3:30 to 5:00pm |
| Mon, Fri, Sat | Freestyle | South | afternoons |

### Costs

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public skating | admission | 1 | $10 | $10 |
| Skate rental | pair | 1 | $4 | $4 |
| Freestyle or Stick N Shoot | session | 1 | $15 | $15 |
| Freestyle / Stick N Shoot package | 10-pass | 10 | $135 | $13.50 |

---

## SkateQuest (Reston)

| | |
|---|---|
| Address | 1800 Michael Faraday Ct, Reston, VA 20190 |
| Phone | (703) 709-1010 |
| Ice sheets | NHL Rink, Olympic Rink |
| Register / pay | pay at the door; prices at https://www.skatequest.com/public-events |
| Source | DaySmart (`company=skatequest`) |

### Repeat times

| Day | Session | Sheet | Time |
|-----|---------|-------|------|
| Mon, Tue, Thu | Adult pick-up hockey | NHL | 11:40am to 1:00pm |
| Wed, Fri | Public skate | NHL | 11:40am to 1:00pm |
| Fri | Public skate | NHL | 7:30 to 9:30pm |
| Sat | Public skate | NHL | 1:10 to 3:00pm |
| Sun | Public skate | NHL | 3:10 to 5:10pm |
| Mon to Fri | Freestyle | NHL, then Olympic | 5:40am through the afternoon |

### Costs

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public skate | admission | 1 | $10.00 | $10.00 |
| Skate rental | pair | 1 | $4.00 | $4.00 |
| Freestyle | session | 1 | $8.75 | $8.75 |
| Stroking | session | 1 | $13.00 | $13.00 |
| Adult pick-up hockey or Stick & Shoot | session | 1 | $15.00 | $15.00 |

---

## MedStar Capitals Iceplex (Arlington)

| | |
|---|---|
| Address | 627 N Glebe Rd, Suite 800, Arlington, VA 22203 |
| Phone | (571) 224-0555 |
| Ice sheets | Capitals Rink, Arlington Rink |
| Register / pay | every drop-in is pre-paid online in DASH: https://apps.daysmartrecreation.com/dash/x/#/online/capitals/event-registration?&program_types=3 |
| Source | DaySmart (`company=capitals`), classified by league sport |

### Repeat times

Public skates are published a few weeks ahead around the Capitals' practice schedule and
vary; typical slots on the Arlington Rink are Sunday 1:50 to 2:50pm ("Recess") and 3:00 to
4:00pm, Tuesday 4:30 to 5:20pm, and the Monday 8:40am Arlington County Senior Skate ($1).
Freestyle runs weekdays in 30-minute slots. Stick n Shoot and pickup hockey appear week by week.

### Costs (DASH products catalog; the checkout is authoritative)

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public skate, general | admission | 1 | $15 | $15 |
| Public skate, adult / 12 and under / holiday | admission | 1 | $9 / $8 / $10 | |
| Freestyle | session | 1 | $10 | $10 |
| Stick n Shoot | session | 1 | $20 | $20 |
| Pickup hockey 18+ (goalies free) | session | 1 | $20 | $20 |
| Arlington Senior Skate | admission | 1 | $1 | $1 |

---

## Fairfax Ice Arena

| | |
|---|---|
| Address | 3779 Pickett Rd, Fairfax, VA 22031 |
| Phone | (703) 323-1132 |
| Ice sheets | one (Main Rink) |
| Register / pay | public skate at the box office only; pick-up hockey in DASH; prices at https://www.fairfaxicearena.com/public-skate-hours.html |
| Source | DaySmart (`company=fairfax`); freestyle is in Mindbody and not pulled yet |

### Repeat times

Public skate hours are posted on the prices page and change seasonally; the live list is the
authoritative schedule. Pick-up hockey is listed in DASH event registration.

### Costs

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public skate, weekday | admission | 1 | $10.25 | $10.25 |
| Public skate, weekend / holiday | admission | 1 | $11.25 | $11.25 |
| Public skate punch card | 10 admissions | 10 | $83 | $8.30 |
| Skate rental | pair | 1 | $4 | $4 |
| Pick-up hockey | session | 1 | $20 | $20 |
| Freestyle credits | 40 / 180 credits (4 to 6 per session) | 7 to 45 | $124 / $406 | about $9 to $18 |

---

## Mount Vernon RECenter Ice Arena (Alexandria)

| | |
|---|---|
| Address | 2017 Belle View Blvd, Alexandria, VA 22307 |
| Phone | (703) 768-3224 |
| Ice sheets | Red Rink, Blue Rink |
| Register / pay | pre-pay online in the county ticket store: https://fairfax.usedirect.com/FairfaxFCPAWeb/ACTIVITIES/Search.aspx?category_name=ice%20tickets&place_id=7949 (public skate, stick and puck, pickup hockey; some morning public sessions are door only) |
| Source | the county's four PDF month calendars (public, freestyle, hockey, ice dance), parsed by `rinks/mount-vernon-recenter/pdf.js`; the ticket store adds sign-up links and seat counts when reachable |

### Repeat times

| Day | Session | Time |
|-----|---------|------|
| Mon to Fri | Public skate (door only) | 7:00 or 7:15 to 9:00/9:15am, then 9:15/9:30 to 11:00/11:15am |
| Mon to Fri | Stick and Puck | 5:15 or 5:30 to 7:00am |
| Mon, Wed, Fri | Pickup hockey | 11:30am to 1:00pm (Wed 12:15pm) |
| Mon | Public skate | 3:15 to 5:15pm; adults only 7:00 to 8:30pm |
| Tue | Public skate | 12:15 to 2:15pm, 2:30 to 4:30pm |
| Wed | Public skate | 2:30 to 4:00pm |
| Thu | Public skate | 10:00am to 12:00pm, 3:15 to 5:15pm |
| Fri | Public skate | 2:15 to 4:15pm, 7:00 to 8:30pm |
| Sat | Public skate | 10:45am to 12:00pm, 12:15 to 2:00pm |
| Sun | Public skate | 12:00 to 2:00pm, 2:15 to 3:45pm |
| Daily | Freestyle | early morning and midday blocks on both sheets |
| Tue to Fri | Ice dance | around 12:00 to 3:00pm |

### Costs (public skate includes rental; members free)

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public skate, child 4 and under | admission | 1 | $4 | $4 |
| Public skate, youth 5 to 18 / senior 65+ | admission | 1 | $10 | $10 |
| Public skate, adult 19+ | admission | 1 | $14 | $14 |
| Public skate, family (up to 5) | admission | 1 | $40 | $8 |
| Public skate discount book, youth/senior / adult | 10 visits | 10 | $54 / $90 | $5.40 / $9 |
| Stick and Puck, Pickup Hockey, Ice Dance | session | 1 | $17 | $17 |
| Specialty session pass | 10 visits | 10 | $153 | $15.30 |
| Freestyle | session | 1 | $9 | $9 |

---

## Prince William Ice Center (Dale City)

| | |
|---|---|
| Address | 5180 Dale Blvd, Woodbridge, VA 22193 |
| Phone | (703) 730-8423 |
| Ice sheets | NHL, Olympic |
| Register / pay | pay at the door; prices at https://www.innovativesportsva.com/page/show/8780814-public-skate |
| Source | Frontline Connect monthly HTML pages (public, stick-n-shoot, freestyle, pickup); lessons and leagues are not exposed |

### Repeat times

Public sessions most days: late morning on weekdays (about 11:50am to 1:10pm) and
afternoons on weekends (12:10 to 1:30pm, 4:30 to 5:50pm), alternating sheets. Stick-n-Shoot
about nine times a week; freestyle daily in morning and midday blocks on both sheets.

### Costs

| Item | Unit | Sessions | Price | Per session |
|------|------|----------|-------|-------------|
| Public skate | admission | 1 | $10 | $10 |
| Skate rental | pair | 1 | $5 | $5 |
| Freestyle | hour | 1 | $14 | $14 |
| Stick-n-Shoot | session | 1 | $17 | $17 |

---

## Not integrated

- **The St. James (Springfield)**, 6805 Industrial Rd, (703) 239-6870. Two NHL rinks. The
  schedule page (https://www.thestjames.com/activities/spr/ice-house) is fed by a private
  JSON API at hub.thestjames.com that requires an app client-id header; it was not pulled.
  Public skate is Fridays 7:30 to 8:50pm ($10 non-members, members free), stick and puck
  weekday late mornings ($16), adult pick-up Friday mornings ($20); book in the app or on
  the site.
- Seasonal outdoor rinks (Westpost/Pentagon Row in Arlington, Reston Town Center, Cameron
  Run in Alexandria, Harris Pavilion in Manassas) are open-hours rinks rather than session
  schedules and are not listed.

## Ground rules for using these feeds

- **Read only.** Public, unauthenticated read endpoints only. Nothing here touches
  registration, checkout, or anything behind a login.
- **Do not request personal data.** DaySmart accepts `include` parameters for
  customers and registrants. Never request those.
- **Do not display staff fields.** Some feeds leak employee usernames and
  modification timestamps. The adapters drop them.
- **Cache.** Both rinks publish weeks ahead and change rarely. The server caches for
  five minutes; the ION widget itself refreshes every 30 seconds.
- **Honour unpublished flags.** Events a rink marks unpublished or closed are hidden.

## Third-party aggregators

[openskatecalendar.com](https://openskatecalendar.com) and openhockeycalendar.com
already aggregate both rinks. They are a React app on a Supabase database that
scrapes the rinks' own sources, so they are a step removed from the truth. Prefer
the rinks' own feeds documented here.

## Adding a rink

1. Copy `rinks/_template/` to `rinks/<rink-slug>/`.
2. Research the feed and fill in the README: site, vendor, endpoints, request and
   response shape, field notes, repeat times, costs, gotchas, CORS.
3. Implement `adapter.js` (`fetchEvents({from, to})` returning normalised events,
   plus a pure `normalize(raw)` for tests). The server picks it up automatically.
4. Drop a trimmed real response into `samples/` and add a test in `test/`.
5. Add a row to the table at the top of this file and a section with location,
   repeat times, and costs.
