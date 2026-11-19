# Elsewhere: the frontend

Everything happening in your city, set out like a timetable you can act on.

<p>
  <img src="docs/home-day.png" alt="Elsewhere home by day: TONIGHT IN MUMBAI set large, a split-flap clock, and tonight's events as timetable rows with a yellow NOW line" width="49%" />
  <img src="docs/home-night.png" alt="The same home page after 18:00, as a lit departure board in deep blue and amber" width="49%" />
</p>

Elsewhere gathers gigs, workshops, matches, meetups and free walks from ticketing sites, community calendars and city open data, and shows them soonest first. This folder is the Next.js app; the API and scrapers live in `../backend`.

## What you can do

- **Tonight** (`/`): the city's departures timetable. Tabs for today, tomorrow and the weekend; a live NOW line between what has started and what departs next; a plain-words search ("free tech events this weekend").
- **Explore** (`/explore`, `/categories/<slug>`): every listing with filters for category, mood, date and price, and search by meaning.
- **Map** (`/map`): the city at night, with a timeline you can scrub to see what is on at any hour, travel times and a phone card strip.
- **Keep it**: save events, get reminders, add to your calendar, plan a day around them (`/plan-my-day`), collect passport stamps, replay your month (`/recap`).
- **Go with friends** (with an account): profiles, friends, who's going, lists and "who's free?" polls.

## Design: the city timetable

Every city is a timetable and every event is a departure. The site follows the sun in the chosen city: a printed timetable by day (white paper, blue-black ink, signal yellow), and a lit departure board from 18:00 to 06:00 (deep blue, warm white, amber). The map always runs on the night board. Settings can pin either one.

- Tokens: `src/app/tokens.css` (semantic names, OKLCH, both themes designed). The rules are in [`DESIGN.md`](DESIGN.md).
- Type: Archivo (variable width, condensed for times and headlines), Geist for reading, Geist Mono for codes and labels. All self-hosted through Fontsource.
- Signature: `src/components/Timetable.tsx` (the home hero), with `FlapText` for the split-flap times.
- Theme: `src/lib/theme.ts` sets the theme before first paint; `src/components/ThemeSync.tsx` keeps it current.

<p>
  <img src="docs/event-day.png" alt="An event page by day: the title set large beside a square-framed poster, and a boarding pass with the date, departure time, venue and entry" width="49%" />
  <img src="docs/event-night.png" alt="The same event page at night" width="49%" />
</p>

## Run it

Needs Node 20 or newer and the backend running (see `../README.md`). Without the backend the app shows a labelled sample timetable.

```bash
npm install
cp .env.example .env.local   # then fill in the values you have
npm run dev                  # http://localhost:3000
```

| Command | What it checks |
|---|---|
| `npx tsc --noEmit` | types |
| `npm run lint` | ESLint (Next.js core web vitals + TypeScript) |
| `npm test` | Vitest unit tests for the pure logic in `src/lib` |
| `npm run build` | production build |

## Stack

Next.js 16 (app router), React 19, Tailwind CSS 4 (as the CSS pipeline; styles are plain CSS on the tokens), Motion, MapLibre GL, Supabase (accounts and social), web-push.

Screenshots above use the bundled sample events with the poster fallback art, so no listing is shown with someone else's image.
