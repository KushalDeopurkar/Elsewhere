# Elsewhere design system: the city timetable

Single source of truth for every visual decision. Tokens live in `src/app/tokens.css`; components use only the semantic names.

## Idea
Every city is a timetable and every event is a departure: a start time, a destination (the event), a platform (the venue), a status (on now, in 40 min, free). The structure of a printed station timetable carries the information: ruled rows, tabular times, codes, one signal colour. Nothing is decoration that the timetable would not print.

## Two designed themes, chosen by the sun
- **Day (06:00 to 18:00 in the chosen city):** printed timetable. Cool white paper `--bg`, blue-black ink `--fg`, signal yellow `--signal` as a band, a fill and a line, never as text on paper (`--signal-text` is its readable ochre).
- **Night (18:00 to 06:00):** the lit departure board. Deep blue `--bg`, warm white type, amber `--signal`.
- `<html data-theme>` is set before paint by `themeBootScript()`; `ThemeSync` keeps it current; Settings can pin Day or Night. Any subtree can opt into the board with `data-theme="night"` (the map does).
- Category hues are data, not brand: one hue each, lightness set per theme (`--cat-l`).

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
