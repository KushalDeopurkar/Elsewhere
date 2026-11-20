# Missile log: Elsewhere frontend

status: stage=0 iteration=5 verdict=CONTINUE updated=2026-11-20T09:52:03.627Z
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
| dimension | baseline | it1 | it2 | it3 | it4 | it5 | target |
|---|---|---|---|---|---|---|---|
| first_impression | 6 | 7 | 8 | 8 | 9 | 9 | 9+ |
| design_system | 4 | 7 | 7 | 8 | 8 | 8 | 9+ |
| layout | 6 | 6 | 7 | 8 | 8 | 8 | 9+ |
| motion | 5 | 6 | 7 | 8 | 8 | 8 | 9+ |
| ux_completeness | 5 | 6 | 7 | 8 | 8 | 7 | 9+ |
| accessibility | 6 | 8 | 7 | 8 | 9 | 8 | 9+ |
| performance | 6 | 8 | 9 | 9 | 9 | 9 | 9+ |
| code_health | 6 | 7 | 7 | 8 | 9 | 8 | 9+ |
| story | 4 | 7 | 8 | 9 | 9 | 8 | 9+ |
| shipped | 5 | 5 | 5 | 5 | 5 | 5 | 9+ |
| **mean** | 5.3 | 6.7 | 7.2 | 7.9 | 8.2 | 7.8 | 9.5+ |
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

### Iteration 1 · 2026-11-19T21:38:14.840Z
- mean 6.7, min 5, verdict **CONTINUE**
- url: http://localhost:3100
- screens: /, /explore, /map, /events/d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101, /categories/technology, /saved, /passport, /plan-my-day, /settings, /friends, /recap, /alert, /privacy
- next fixes:
  - [S] layout: Delete content-visibility and contain-intrinsic-size from .shell.sec (core.css:205-208) so home renders every rail instead of about 2,300 px of blank paper; re-shoot to confirm. This was flagged in it0 and not applied. (src/app/core.css)
  - [S] ux_completeness: Filter sample events by a 40 km radius from the chosen city, so neither 'Tonight in Mumbai' nor '18 events near Mumbai' lists Bengaluru or Delhi events; print 'Online' once. Flagged in it0 and not applied. (src/lib/api.ts, src/lib/demoEvents.ts, src/hooks/useCityEvents.ts)
  - [S] code_health: Add an /api/events/search route handler with a timeout that returns the labelled sample set with HTTP 200 when the backend is down, removing the console 500 on every home and explore load; fix the shot sensor so it records console errors. (src/app/api/events/search/route.ts, next.config.ts, src/lib/api.ts)
  - [S] first_impression: Under 640 px, put the departures table directly under the masthead and move the search and 'Try' prompts below it, so the first phone viewport shows the NOW line and two departures. (src/app/page.tsx, src/app/core.css)
  - [M] layout: On phones, hide the tab bar while the event action bar is pinned, stop the map peek strip overlapping the error card, and replace the empty WHERE box with an address-and-directions row when tiles fail. (src/components/EventActionBar.tsx, src/components/Nav.tsx, src/app/map/page.tsx, src/components/EventMap.tsx, src/app/events.css)
  - [S] motion: Remove the overshoot curves and the cw-* infinite loops, set --t-enter to 200ms, and cap the 520 to 900 ms entrances at 240 ms. (src/app/redesign.css, src/app/tokens.css)
  - [L] design_system: Restyle /passport to the timetable system (square stamps, ruled numbered sections, no wash banner or Fire icon), then fold the rules still used from redesign.css and stories.css into the core sheets and delete both files. (src/components/PassportView.tsx, src/app/redesign.css, src/components/stories.css, src/app/core.css)

### Iteration 2 · 2026-11-19T21:54:06.881Z
- mean 7.2, min 5, verdict **CONTINUE**
- url: http://localhost:3100
- screens: /, /explore, /map, /events/d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101, /categories/technology, /saved, /passport, /plan-my-day, /settings, /friends, /recap, /alert, /privacy, /opengraph-image, /events/d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101/opengraph-image
- next fixes:
  - [S] accessibility: Fix the two day-theme contrast failures: delete social.css:621-623 so footer Privacy/Terms use --board-fg (now 1.6:1 on every page), and give the plan-my-day city select color var(--fg) on paper (now about 1.05:1). Add both to the tokens contrast test. (src/app/social.css, src/app/core.css, src/app/planner.css, src/components/PlanMyDayView.tsx)
  - [S] code_health: Add an /api/events/search route handler with a 3 s timeout that returns the labelled sample set with HTTP 200 when the backend fails, removing the console 500 on home, explore, map and category pages. This was the it1 fix and was not applied. Then re-shoot from HEAD. (src/app/api/events/search/route.ts, src/lib/api.ts, next.config.ts)
  - [M] first_impression: Keep the hero board at three or more departures: when tonight has fewer, continue with tomorrow's rows under a ruled 'Tomorrow' divider, and drop the 18rem panel floor once rows settle so phones show no blank band. (src/components/Timetable.tsx, src/app/core.css)
  - [M] layout: On phones, hide the tab bar while the event action bar is pinned. Replace the dark WHERE frame with an address-and-Directions row when tiles fail. Remove the cut-off on the explore filter rail. Number home sections from what is rendered (no skipped 02). The first two were it1 fixes and are not applied. (src/components/EventActionBar.tsx, src/components/Nav.tsx, src/components/EventMap.tsx, src/app/events.css, src/app/explore.css, src/app/page.tsx)
  - [S] motion: Delete the cw-* infinite loops (moved, not removed, in it2) and pin-pulse, set --t-enter to 200ms, and cut the 500 ms theme crossfade to 240 ms. (src/app/passport.css, src/app/map.css, src/app/tokens.css, src/app/core.css, src/components/CategoryWorld.tsx)
  - [S] story: Add a README Credits section, re-shoot the docs screenshots from HEAD with one phone shot, and give /map its own title and description. (README.md, docs/, src/app/map/page.tsx)
  - [L] design_system: Restyle /passport (square stamps, ruled Archivo heads, mono counters, no wash banner or round badge counters) and the plan-my-day panels to the timetable system, then fold components/stories.css into the core sheets and delete it. (src/components/PassportView.tsx, src/components/PassportStamp.tsx, src/app/passport.css, src/app/planner.css, src/components/stories.css)

### Iteration 3 · 2026-11-19T22:06:32.633Z
- mean 7.9, min 5, verdict **CONTINUE**
- url: http://localhost:3100
- screens: /, /explore, /map, /events/d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101, /categories/technology, /saved, /passport, /plan-my-day, /settings, /friends, /recap, /alert, /privacy, /opengraph-image, /events/d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101/opengraph-image
- next fixes:
  - [S] first_impression: Fix the signature's two visible faults: in FlapText.tsx always set the target glyph and remove .is-flipping at settle (the 14:00 '1' is stuck grey on home-1440-day.png), and make the board header count every row shown ('1 tonight, 4 tomorrow') instead of '1 DEPARTURE' over five rows. Add a test for each. (src/components/FlapText.tsx, src/components/Timetable.tsx, src/lib/)
  - [S] ux_completeness: De-duplicate home with one 'shown' set passed down board, reel, Headliners, This week, Free entry and This weekend in that order, dropping a rail left with fewer than three cards (the it2 fix was applied to This week only). Also render passport stats as 'Stamps' over '0/12', and hide map tools while the tile-failure card shows. (src/app/page.tsx, src/components/PassportView.tsx, src/components/ExploreView.tsx)
  - [S] accessibility: Extend the keyboard sensor to /events/[id] (share dialog with Escape), /map (Map/List switch) and the explore filter drawer at 390, printing accessible names, and add a sequential-frame capture of the home load; both were asked in it1 and it2 and are still home-only, which caps accessibility and motion. (.missile/shots/it3-sense/keyboard.txt (sensor script that writes it))
  - [S] layout: Add a right-edge mask fade to the /map chip row (it2 fix, not applied), set passport stamps to two columns under 480 px, and make the plan-my-day 'In your own words' panel sticky on desktop. (src/app/map.css, src/app/passport.css, src/app/planner.css)
  - [M] design_system: Remove the box-in-a-box on the planner prompt field, replace the 13 hex literals with tokens and fold reel.css into core.css, unify the saved, friends and settings empty states on one .empty container, and set alert and privacy titles in the Archivo display style. (src/app/planner.css, src/components/DayPlanner.tsx, src/app/reel.css, src/app/core.css, src/app/alert/page.tsx, src/app/privacy/page.tsx)
  - [S] motion: Cut the sunset crossfade in core.css:42 from 500 ms to 240 ms, and reserve the board's final height while listings load so home CLS (0.085) drops back under 0.06. (src/app/core.css, src/components/Timetable.tsx)
  - [M] shipped: Owner's call after the loop: push the branch, verify the Vercel preview in a private window at 390 and 1440, run a fresh clone per the README, then tag. (README.md)

### Iteration 4 · 2026-11-19T22:17:34.515Z
- mean 8.2, min 5, verdict **CONTINUE**
- url: http://localhost:3100
- screens: /, /explore, /map, /events/d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101, /categories/technology, /saved, /passport, /plan-my-day, /settings, /friends, /recap, /alert, /privacy, /opengraph-image, /events/d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101/opengraph-image
- next fixes:
  - [S] ux_completeness: Finish the home de-duplication: seed page.tsx's shown set with the board rows actually displayed, and filter the reel against it, so Weekend Volunteer Drive, Basement Tapes and Vinyasa each appear once below the board. The it3 fix covered the rails only. (src/app/page.tsx)
  - [S] motion: Bring the hero sequence inside 900 ms and readable from the first frame. Cap the board riffle so tiles settle within 500 ms of their row and use digit-only glyphs in time cells. Add a metric-matched Archivo fallback and preload the wdth woff2 so 'TONIGHT IN MUMBAI' shows at 100 ms without a reflow. This also lowers home CLS (0.087). (src/components/FlapText.tsx, src/app/tokens.css, src/app/layout.tsx, src/app/core.css)
  - [M] shipped: Owner's call after the loop: push the branch, verify the Vercel preview in a private window at 390 and 1440, run a fresh clone per the README, then tag. (README.md)
  - [S] layout: Hide rail arrows when the rail does not overflow (the 'This weekend' rail at 1440), make the planner's 'In your own words' panel sticky above 1024 px, and shorten the clipped category search placeholder at 390. (src/components/Rail.tsx, src/app/planner.css, src/app/categories/[slug]/page.tsx)
  - [S] design_system: Remove the planner prompt's inner border (box-in-a-box, asked in it3 and not applied), and give the /map and event tile-failure cards one stripe and fill with left-aligned body text. (src/app/planner.css, src/app/map.css, src/app/events.css)
  - [S] code_health: Capitalise each sentence in composeRequest (the planner preview reads '. starting' and '. keep'), and add tests for it and for FlapText settle. (src/components/DayPlanner.tsx, src/components/FlapText.tsx, src/lib/)
  - [S] story: Add docs/home-phone.png (the first viewport of home-390-night.png) to the README hero row. (README.md, docs/)

### Iteration 5 · 2026-11-20T09:52:03.627Z
- mean 7.8, min 5, verdict **CONTINUE**
- url: http://localhost:3100
- screens: /, /explore, /explore?q=I%20want%20to%20meet%20startup%20founders, /explore?q=free%20AI%20workshops%20this%20weekend, /explore?q=free%20AI%20workshops%20this%20weekend&widen=topic, /explore?cat=tech&price=free&when=week, /map, /events/d1a7f2c0-0001-4a10-9c21-5f3e9b0a1101, /categories/technology, /saved, /passport, /plan-my-day, /settings, /recap, /opengraph-image
- next fixes:
  - [S] ux_completeness: Make the AI read plurals and own up to empty interests. Accept an optional 's'/'es' suffix in findPhrase so 'free AI workshops this weekend' and 'meet startup founders' read Workshop and Founder. When a named interest has zero matches in the city, say so above the results and offer the nearest match elsewhere (Seed Stage: Founder Pitch Night, Bengaluru) as a refinement. Add tests for both. (src/lib/intent.ts, src/lib/intent.test.ts, src/components/ExploreView.tsx)
  - [S] ux_completeness: Stop the map inventing a place and hiding pins. Skip pins for online events (Fine-Tuning sits at Mumbai's centre), list them as 'Online, no pin', and fit the first view to the events' bounds with padding for the desktop list panel and the phone label and card strip. Two of eight pins are under the panel at 1440, and South Mumbai is off-screen. (src/app/map/page.tsx, src/components/EventMap.tsx)
  - [S] ux_completeness: Finish the home de-duplication asked in it4. Add the board's displayed rows to the shown set before picking Headliners (today all three are board rows), and filter the weekend reel against it. (src/app/page.tsx)
  - [S] accessibility: Keep focus in place on Explore. After a filter chip is removed, focus the next chip, or 'Clear all', or the results heading. After 'Clear all', focus the results heading. Today focus falls to <body>. (src/components/ExploreView.tsx)
  - [M] ux_completeness: Make the interpreted request controllable. Turn each 'Reading as' chip into a remove button (dropSignal plus a URL update), and show the applied when, free, format and interest in the filter rail instead of 'Any'. (src/components/ExploreView.tsx, src/components/FilterRail.tsx, src/lib/intent.ts)
  - [S] motion: Keep ':' static in FlapText (it riffles letters such as '2OL79'), and cap the riffle so the board reads by 800 ms. Add the FlapText test. (src/components/FlapText.tsx)
  - [S] story: Carry the 3.0 rename into the share media: redraw the site OG as 'WHAT'S ON IN YOUR CITY' with mixed kinds of event, update the event OG fallback, the manifest description and 'Tonight' shortcut, AccountsOff's 'Tonight's timetable' and PRODUCT.md. Also fix the orphaned category swatch on wrapped ticket labels. (src/app/opengraph-image.tsx, src/app/events/[id]/opengraph-image.tsx, src/app/manifest.ts, src/components/AccountsOff.tsx, src/components/EventCard.tsx, PRODUCT.md)

<!-- iterations:end -->

## Decisions

- Direction chosen by Claude at the user's request ("pick something that would suit my website"); the gate question was skipped for that reason. Direction sent to the user as a message.
- Night theme is a deep blue board with amber light: close to the banned "near-black + one pop" look, kept because a departure board is the subject's own vernacular, and it is blue, not black, with the timetable structure carrying the identity.
- Installed @fontsource-variable/archivo (variable width axis drives the timetable numerals).
- Sensors: sense.mjs for the baseline; a local Playwright script (stand-in photos, scroll before capture) for later iterations because the image CDN is blocked in the sandbox.
- Work happens in a sandbox copy; it ships to the user's Mac as a branch, never pushed.
- Not done, for the owner: a Next.js route handler in front of `/api/events/search` that would turn a sleeping backend's 500 into a labelled 200. Route handlers take precedence over the rewrite, so every production search would pass through a serverless function (latency, cost, a second place for the contract). The client already falls back to the labelled sample set; the 500 stays the honest signal. Owner's call.
- Event pages hide the phone tab bar so the event's own action bar (price, going, tickets) owns the bottom edge; the header still leads home.
- Decorative CategoryWorld backdrops, the custom cursor, the kinetic headline and the scramble text were removed as decoration; no feature depended on them.
- Poster tint now only tints the poster's own frame (type stays on theme tokens so it reads in both themes).


## Remaining gaps

Flight stopped at the iteration cap (4). Final critic mean 8.2 (from 5.3 at baseline); every dimension except `shipped` at 8 or 9. Fixed after the final score: home sections also skip the reel, digit-only tile riffle, rails without needless arrows, the planner's single field and sentence-case preview, the Explore placeholder.

1. **shipped (5):** not deployed from this branch. Owner: push `missile/20261120`, open the Vercel preview in a private window at 390 and 1440, then merge and tag (`v2.0.0-missile`).
2. **Console 500s while the backend sleeps:** see Decisions; a route handler would remove them at the cost of a serverless hop on every search.
3. **Font swap on first paint:** Archivo loads with `font-display: swap`, so the masthead can reflow once on a cold visit (home CLS about 0.06 to 0.09). A preloaded font file or a size-matched fallback would remove it.
4. **Map and planner tile-failure cards** use slightly different treatments; unify when the map page next changes.

## Handover

- Branch: `missile/20261120` (frontend only; backend untouched). Every commit authored by Kushal.
- Run: `cd frontend && npm install && npm run dev`; checks: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- Demo first: the home page after 18:00 in any city, then pin Day in Settings to see the printed timetable.
