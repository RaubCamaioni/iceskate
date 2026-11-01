# Wheaton Ice Arena (Wheaton, MD)

| | |
|---|---|
| Address | 11717 Orebaugh Ave, Wheaton, MD 20902 (Wheaton Regional Park) |
| Phone | (301) 905-3000 |
| Operator | Montgomery Parks (M-NCPPC) |
| Website | https://montgomeryparks.org/parks-and-trails/wheaton-ice-arena/ |
| Schedule pages | `.../wheaton-ice-arena/schedules-fees/` + `wheaton-ice-arena-public-skating-sessions/`, `-hockey-sessions/`, `-figure-skating-sessions/` |
| Sheets | one |
| Online pre-pay | public skating is in person only; stick and puck and freestyle book on ActiveMONTGOMERY |

Checked 2026-10-31. About 28 miles from Leesburg.

## Where the schedule comes from

Same operator and page style as Cabin John (see `rinks/cabin-john-ice-rink/README.md` and
`lib/montgomeryparks.js`), with two differences:

- The weekly public-skating schedule is a **table** (Day | Time | Session) with several
  sessions per cell separated by line breaks, paired by position. Dashes vary ("9:00 am –
  10:30 am", "10:45 -11:45 am", "12:30 pm- 2:00 pm"). A day cell can be date-restricted:
  "Monday- November 2 and December 28" means those Mondays only (school holidays).
- Stick and Puck rows may hold two sessions ("10:45 am-12:15 pm, / 8:15-9:45 pm"). The
  freestyle page has two tables (the current day and the month) with slightly different
  headers.

Fees and classification are the same as Cabin John.

## Repeat times (fall schedule)

| Day | Session | Time |
|---|---|---|
| Wed, Thu, Fri | Adult session | 9:00 to 10:30am |
| Tue, Wed, Thu | Parent and Tot | 10:45 to 11:45am |
| Tue, Wed | Public session | 1:00 to 2:30pm |
| Thu | Public session | 12:30 to 2:00pm and 4:15 to 5:45pm |
| Fri | Public session | 12:30 to 2:00pm and 6:00 to 8:00pm |
| Sat | Public session | 12:30 to 2:30pm and 4:30 to 6:30pm |
| Sun | Public session | 11:00am to 1:00pm and 3:00 to 5:00pm |
| Mon | Public session | 1:00 to 2:30pm on school-holiday Mondays only |
| Mon to Fri | Freestyle | early mornings and afternoons |

## Costs

As Cabin John: regular $9, tots $5, senior $7 weekdays, Cheapskate $9 with rental, rental $4,
10-admission book $81; stick and puck $11 to $15; freestyle $9 per 30 minutes, punch passes
$160 / $300 / $520.

## Samples

`samples/*-2026-10-31.html`: the `<main>` content of the four pages as published.
