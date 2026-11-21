# Elsewhere design system: the city timetable

Single source of truth for every visual decision. Tokens live in `src/app/tokens.css`; components use only the semantic names.

## Idea
Every city is a timetable and every event is a departure: a start time, a destination (the event), a platform (the venue), a status (on now, in 40 min, free). The structure of a printed station timetable carries the information: ruled rows, tabular times, codes, one signal colour. Nothing is decoration that the timetable would not print.

## Two designed themes, chosen by the sun
- **Day (06:00 to 18:00 in the chosen city):** printed timetable. Cool white paper `--bg`, blue-black ink `--fg`, signal yellow `--signal` as a band, a fill and a line, never as text on paper (`--signal-text` is its readable ochre).
- **Night (18:00 to 06:00):** the lit departure board. Deep blue `--bg`, warm white type, amber `--signal`.
- `<html data-theme>` is set before paint by `themeBootScript()`; `ThemeSync` keeps it current; Settings and the header's display switch can pin Day, Night or Vivid. Every page follows the choice, the header, tab bar and map included (the map has its own day, night and vivid basemap palettes in `mapTheme.ts`; city lights run at night only). The monthly recap stays a night slideshow by design. Any subtree can still opt into the board with `data-theme="night"`.
- Category hues are data, not brand: one hue each, lightness set per theme (`--cat-l`).

## Vivid: the city's transit map at night

The third look, chosen by the person from the display switch in the header or in Settings, never by the sun. A printed line map after dark: warm charcoal surfaces, one vermilion signal for actions and "now", and all other colour from the category lines, flat and at full strength, each used only where its category is (departure times, card edges, section roundels, map clusters). No gradients, no glows. The earlier magenta-to-cyan version read as generic and was replaced. Set as `<html data-theme="night" data-palette="vivid">`; tokens in `tokens.css`, the rest in `vivid.css`.

## The network: backdrop and masthead

- **Backdrop** (`NetworkBackdrop.tsx`, every theme): a schematic line map, octilinear (0°, 45°, 90°), stations at the turns, drawn once from a fixed seed. Full strength in the margins outside the content column, a faint trace behind it, so the page never reads as an empty field and text always sits on plain background. Faintest by day, strongest in Vivid.
- **Masthead** (`TodayNetwork.tsx`): the next 36 hours as a line map. Each kind of event with something on is a line (up to five), each real listing a stop in time order; stops open the event, and hovering or focusing one names it below. It fills the right of the masthead on wide screens; phones skip it so search stays near the top, and the board below lists the same events.

## Type
| Role | Face | Use |
|---|---|---|
| Display | Archivo (variable, width 62 to 125) | Times and the masthead at width 62 to 75, weight 800 to 900. Titles at width 85 to 100, weight 650. |
| Body | Geist | Reading, controls. 16px base, 1.55 line height. |
| Mono | Geist Mono | Codes, labels, metadata, the clock. Uppercase labels at 0.08em tracking, never under 12px. |
Scale 1.25 from 16px (`--t-*`), plus `--t-mast` and `--t-time`. Times always `tabular-nums`.

## Layout
- Rules, not boxes. A 2px ink rule opens a section; hairlines (`--rule`) separate rows. Cards exist only as tickets (an event you can take).
- Corners are cut square (`--r-*` = 2px). Only dots and faces are round (`--r-round`).
- 12-column shell, 84rem max, 16px gutter on phones, 32px from 640px.
- Section rhythm: 48px inside, 96px between.

## Components
- **Nav:** a full-width ink band (the timetable header) with the wordmark, numbered doors (01 Tonight, 02 Explore, 03 Map), the city and its clock. Active door gets a 4px signal bar. Phones get the same band as a bottom tab bar.
- **Ticket (EventCard):** poster cut square, a perforated stub under it with the date and time set big in condensed Archivo, the category code, title and venue. Price is a stamped tag on the poster.
- **Timetable row:** time | departure | platform | status. Hover slides a signal band in from the left.
- **Buttons:** primary is a signal-yellow slab with ink text; secondary is an ink-outlined slab; text buttons are underlined with a signal underline.
- **Tags and filters:** square, hairline border; selected inverts to ink.
- **Status:** ON NOW (green dot), IN 40 MIN (signal), FREE, price. Status words are uppercase mono.

## Motion budget
- Page load: the timetable rows flip in once (split-flap on the times, 40ms stagger, under 900ms total).
- UI: 120 to 200ms ease-out, transform and opacity only.
- Theme change at sunset: a 500ms colour crossfade, only when the hour turns.
- Route transitions: the existing view transitions, 200 to 300ms.
- `prefers-reduced-motion`: no flips, no stagger, instant theme.

## Banned here
Rounded cards, pills, glows, gradients, glass, story circles, sparkles for AI, centred hero copy, a second accent.

## Elsewhere 3.0: decisions

Compared version 1 (`main`, midnight and coral) and version 2 (`missile/20261120`, the city timetable) before building.

| | Version 1 | Version 2 | 3.0 |
|---|---|---|---|
| Look | Near-black with one coral pop, rounded cards, pills, gradients, sparkle icons: the generic dark-SaaS look (critic 5.3/10) | Designed day and night themes on OKLCH tokens, Archivo/Geist, tickets, ruled sections (8.2/10) | Version 2's system, kept |
| First screen | AI search hero ("Find your next reason to step out") with a departures board on the side | "TONIGHT IN MUMBAI" masthead with the timetable as hero | "WHAT'S ON IN MUMBAI" plus one line naming every kind of event; Ask Elsewhere (AI search) leads, the board sits beside it |
| Navigation | Tonight · Explore · Map | Tonight · Explore · Map | **Discover** · Explore · Map: "Tonight" read as nightlife-first |
| AI search | Parses intent; reasons computed but hidden | Same | Intent chips, honest notes when a request can't be filtered, and the reasons on every result ticket |
| Explore filters | Category, mood, date, price | Same | + format (in person / online), distance, removable chips for every filter, Clear all, Show more |
| Map | Pins capped at the soonest 80 in view | Same, night board | + screen-space clustering, category-coloured clusters, list hover lifts the pin |
| Data | De-dupe by id | Same | + the same listing from two sites, cancelled titles and unreadable dates dropped; postponed and sold out shown only when the listing says so |

Why not a third look: version 2's design system already passes contrast, keyboard and performance checks and reads as its own identity; what it lacked was breadth (it framed the site around tonight) and the discovery tools above. 3.0 keeps the system and fixes those.

### Map fixes (after the live screenshot of 20 Nov)

- Events that have already finished are dropped: the map asks for six hours back so "on now" shows, and the list was opening on last night's events.
- Clusters merge until no two markers overlap (the grid alone split neighbours across a cell line).
- Controls: zoom, a compass only once the map is turned, and "Show every event". The two rotate buttons went (right-drag still turns the map); three near-identical arrows read as one.
- The category row fades only on the side with more, scrolls with a mouse wheel, and has arrow buttons on pointer screens.
- Phone cards over the map are solid, so pins never show through their text.
- Clusters are a small stack of their own soonest two posters with the count on a badge in the main category's colour (a coloured disc when none has a picture), sitting flat on the map: the lights tether is for single pins only.
- The display menu lifts the header above the map's filter bar while it is open.

### Forgiving search
- Typed words are spell-checked before the search reads them (`lib/spell.ts`, `lib/fuzzy.ts`): small typos ("pars", "mumbia", "workshp", "tomorow") and unfinished place names ("par") become what was meant. Real words are never changed: the reader's own words, the place list, a list of everyday words, and every word in the events on show count as real, and typos of event words ("comdey") are fixed too.
- The first letter must match, so "june" never becomes Pune.
- Explore says what it did ("Showing results for paris · Search instead for 'pars'"), and `?exact=1` searches the words exactly as typed, with "Did you mean paris?" offered back.
- Matching event titles forgives typos and word starts too ("hack" finds hackathons).

### Search, finished (lib/intent.ts, lib/when.ts, lib/spell.ts)
- A request is split into what the data can answer, each part a removable chip: **words to find**, **days** ("on 22nd", "22 nov", "22/11", "friday", "next friday", "this week", "next month", "in december", "22-25 dec", "christmas"), **time of day** ("after 7pm", "morning", "tonight"), **price** ("free", "cheap", "under ₹500", "between 500 and 1500"), **place**, **format**, and **broad categories** ("music", "tech", "arts").
- Exact first: when there are words to find, a match must contain every one (in the title, venue or description; typos, plurals and a few other-language words like "atelier" or "exposition" forgiven; known phrases like "stand up" kept whole; quoted words must appear together). A few words count by category where listings rarely say them ("concert" finds music events). Anything that only shares the topic, or that the meaning search finds, sits under "Related to your search", never mixed in.
- Specific words ("comedy", "workshop") must be found; only broad category words filter by category. Dates are the search city's calendar days; an event running across several days counts if it overlaps.
- Fetching follows the request: the asked-for days go to the API (so a date weeks away isn't cut off at the next 100 events), and the words are searched on the server too.
- The home board says "Today" at any hour. A long city name shrinks to fit the headline instead of breaking mid-word, and is cut with "…" in the phone header.

### Pictures for cities outside India
- iCal calendars (Luma), SeatGeek and football fixtures arrive without pictures. After each scrape, `run_scrapers.py --images-only` opens each upcoming event's own page and keeps the picture that page shares (event JSON-LD, og:image, Twitter card). A picture a site puts on many pages (its logo) is ignored, and nothing is invented. Scrapes no longer overwrite a picture with an empty value.

## Page bands and the colour layer (21 Nov 2026)

Inner pages read as plain: a big title on a flat field, then thin outlines everywhere. Two changes, both flat colour, square corners, no gradients:

- **Page bands** (`PageHeader` with `line`, styles at the end of `core.css`): every inner page sits on its own line of the network (`PAGE_LINES` in `Section.tsx`: Explore blue, Saved pink, Passport green, Settings teal, Friends violet, Plan my day red; a category page uses its category colour). The band is the line colour tinted into the page, the line itself across the top with three stations, a 2px rule of the same colour closing it. With `posters`, `PosterRail` shows the next four real events with pictures in the city as small tickets (the line colour is their stub) and one count line: coming up, today, free. Phones get a shorter band and a scrolling row of smaller tickets.
- **Colour layer** (`colour.css`, loaded before `vivid.css`): tags and filters are filled, not outlined (neutral: an ink tint; category: its line colour tinted, solid when chosen); suggested searches are signal-tinted; tickets carry a 4px top edge in their category colour and a tinted stub; panels, notes and empty states are tinted fields with a full edge. Side-stripe accents (a thick left border) are retired everywhere: a chosen option is a full fill with a 2px edge.

This supersedes "Tags and filters: square, hairline border" above.
