# Missile log: Elsewhere frontend

status: stage=0 iteration=0 verdict=CONTINUE updated=2026-11-19T21:01:11.847Z
mode: full (existing project, redesign)
branch: missile/20261120
url: none
max_iterations: 4

## Target

- One-liner: everything happening in your city, laid out as a timetable you can act on (see PRODUCT.md)
- Audience: people deciding on a phone around 6pm where to go tonight, in Indian metros and other big cities
- Signature moment: the home timetable with a live NOW line; the whole site follows the sun in the chosen city (day timetable, night board)
- Direction: see DESIGN.md
- Scope: at most three features for a new project; the plan below for an existing one
- User's direction: complete frontend transformation using Bullseye; bold, artistic, original; no AI slop; keep every feature; Claude picks the direction
- Protected: backend, API contracts, auth, routing, data model, every existing feature
- Out of scope: backend and scrapers
- Definition of done: every rubric dimension at 9 or above, mean 9.5 or above, live URL, README, tagged release

## Recon

Next.js 16.3 app router, React 19, Tailwind 4 (used only as the import; styling is plain CSS in globals.css + redesign.css, about 7.6k lines), motion, maplibre, three. 19 pages, about 65 components, 22 test files / 81 tests. Commands: tsc, eslint (0 errors, 1103 warnings), vitest, next build: all green. Theme locked dark, midnight + coral, Bricolage + Geist. Sandbox cannot reach the backend or the image CDN, so evidence runs on the bundled, labelled sample events with stand-in photos.

## Scoreboard

<!-- scoreboard:start -->
| dimension | baseline | target |
|---|---|---|
| first_impression | 6 | 9+ |
| design_system | 4 | 9+ |
| layout | 6 | 9+ |
| motion | 5 | 9+ |
| ux_completeness | 5 | 9+ |
| accessibility | 6 | 9+ |
| performance | 6 | 9+ |
| code_health | 6 | 9+ |
| story | 4 | 9+ |
| shipped | 5 | 9+ |
| **mean** | 5.3 | 9.5+ |
<!-- scoreboard:end -->

## Plan

- [ ] Foundations: typecheck, lint, test, build exist and pass
- [ ] Design system: tokens, two typefaces, kit themed
- [ ] Signature moment: 
- [ ] Screens with states and real copy
- [ ] Features: 
- [ ] First deploy (preview URL)
- [ ] Guidance loop to IMPACT
- [ ] Story: README, OG image, metadata, seed data
- [ ] Ship: final preview, tag, handover

## Iteration log

<!-- iterations:start -->
### Iteration 0 · 2026-11-19T21:01:11.847Z
- mean 5.3, min 4, verdict **CONTINUE**
- url: http://localhost:3100
- screens: /, /explore, /map, /events/d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101, /saved, /me, /passport, /plan-my-day, /settings, /friends, /recap, /alert, /categories/technology, /privacy
- next fixes:
  - [S] first_impression: Route DepartureBoard and WeekendStories images through the EventImage fallback so no broken-image glyph renders, and collapse the board's empty skeleton rows (src/components/DepartureBoard.tsx, src/components/WeekendStories.tsx, src/components/EventImage.tsx)
  - [S] accessibility: Add visible focus rings to event-card title links and the hero search box (src/app/redesign.css)
  - [M] ux_completeness: Make the city filter honest (no Bengaluru or Delhi events under 'near Mumbai'), rewrite the developer-facing map error copy, and give /friends and /settings a next step (src/hooks/useCityEvents.ts, src/components/ExploreView.tsx, src/app/map/page.tsx, src/components/FriendsView.tsx, src/components/SettingsView.tsx)
  - [M] motion: Keep the split-flap board as the one moment; delete CursorLayer, ScrambleText, magnetic pull and looping animations; cap UI transitions at 240 ms (src/app/layout.tsx, src/components/CursorLayer.tsx, src/components/ScrambleText.tsx, src/components/KineticWord.tsx, src/app/globals.css, src/app/redesign.css)
  - [S] code_health: Stop the /api/events proxy 500s when the backend is down (health check or local sample route handler), and add .env.example (src/lib/api.ts, next.config.ts, .env.example)
  - [L] design_system: Replace the near-black plus coral palette with a subject-grounded OKLCH @theme, drop the lilac second accent, and merge redesign.css into one token-driven stylesheet (src/app/globals.css, src/app/redesign.css, src/components/stories.css)
  - [M] story: Rewrite README.md for a judge with two minutes and add a root opengraph-image.tsx (README.md, src/app/opengraph-image.tsx)

<!-- iterations:end -->

## Decisions

- Direction chosen by Claude at the user's request ("pick something that would suit my website"); the gate question was skipped for that reason. Direction sent to the user as a message.
- Night theme is a deep blue board with amber light: close to the banned "near-black + one pop" look, kept because a departure board is the subject's own vernacular, and it is blue, not black, with the timetable structure carrying the identity.
- Installed @fontsource-variable/archivo (variable width axis drives the timetable numerals).
- Sensors: sense.mjs for the baseline; a local Playwright script (stand-in photos, scroll before capture) for later iterations because the image CDN is blocked in the sandbox.
- Work happens in a sandbox copy; it ships to the user's Mac as a branch, never pushed.

## Remaining gaps

(filled at Impact, or on stall)
