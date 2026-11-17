# Taste engine + swipe deck (Elsewhere, engagement piece 1 of 4)

Date: 2026-11-17
Status: approved design, awaiting spec review

## Goal

Make Elsewhere sticky. Users swipe through events, the site learns their taste
from every interaction, and each next screen is better matched. This piece
builds the shared taste engine and the first experience on top of it, the
swipe deck at `/discover`.

Later pieces (separate specs): 2 vibe discovery, 3 immersive vertical feed,
4 live map explorer with time slider. All read the taste engine built here.

## Non-goals

- No accounts or server-side profiles. Taste lives on the device.
- No embedding-based taste vectors yet. The scorer is swappable for that later.
- No database migration.

## Approach

Client-only taste engine in localStorage, following the existing
`lib/saved.ts` + `lib/clientStore.ts` pattern. Plain weighted scoring.
Chosen over server profiles (needs sign-in) and pgvector taste vectors
(API cost and latency per swipe).

## Units

### 1. `src/lib/taste.ts` (taste engine)

Storage key `ee.taste.v1` via `createStore`. Shape:

```ts
interface TasteProfile {
  category: Partial<Record<EventCategory, number>>; // weight per category
  price: { free: number; low: number; mid: number; high: number };   // low <= ₹500, mid <= ₹2000, high > ₹2000
  slot: { morning: number; afternoon: number; evening: number; night: number }; // from start_time, local time
  seen: string[];        // event ids already shown in the deck, capped at 500, newest first
  signals: number;       // total signals recorded
}
```

Signals and weights, applied to the event's category, price band and slot:

| Signal | Weight |
| --- | --- |
| save | +3 |
| open details | +1 |
| dwell over 4 s on a card | +0.5 |
| not now | -0.25 |
| skip | -1 |

Weights per dimension are clamped to [-10, 20] so one binge cannot lock the
profile.

API:

- `recordSignal(event: Event, signal: Signal): void`
- `markSeen(id: string): void`
- `scoreEvent(event: Event, profile: TasteProfile): { score: number; reasons: string[] }`
  score is 0 to 100. With fewer than 5 signals, score is 50 plus a small
  recency bonus, and reasons are empty. Reasons are the top 2 positive
  contributors as plain text, for example "You like Music", "Free",
  "Evening plans". Price reasons use "Free" or "Under ₹500".
- `rankForDeck(events: Event[], profile, opts?: { exploreRate?: number }): Event[]`
  removes seen and past events, sorts by score, then swaps in one random
  lower-ranked event at every 5th position (exploreRate default 0.2) so the
  deck never narrows to a single category.
- `useTaste(): TasteProfile` hook.
- `resetTaste(): void` for a "reset my taste" link on the shortlist screen.

Pure functions (`scoreEvent`, `rankForDeck`, weight updates) take the profile
as an argument so they are unit-testable without localStorage.

### 2. `src/app/discover/page.tsx` + `src/components/SwipeDeck.tsx`

Route `/discover`, metadata title "Discover - Elsewhere". Server page fetches
about 40 upcoming events for the selected city with the existing
`fetchEvents` (same city preference and sample fallback as Explore) and
passes them to the client `SwipeDeck`.

`SwipeDeck` (client):

- Ranks events with `rankForDeck` on mount.
- Renders a stack of 3 cards: top card interactive, two behind it scaled and
  offset. Card: full-bleed `EventImage`, title, date via `formatDate`, venue,
  price via `money`, category chip, match badge ("87% match") and up to 2
  reason tags.
- Gestures with `motion` (`drag`, spring): drag right past 120 px or flick =
  save, left = skip, up = open details (`/events/[id]` in the same tab, signal
  recorded first), down = not now. Card tilts with drag, green glow when
  heading to save, red when heading to skip.
- Keyboard: Right / Left / Up / Down arrows do the same. Visible buttons below
  the deck: Skip, Not now, Details, Save, and Undo.
- Undo reverts the last action: restores the card, removes the save if it was
  a save (`toggleSaved`), and subtracts the signal weight.
- Dwell timer: a card shown for 4 s without action records one dwell signal.
- Every action calls `markSeen` and `recordSignal`. Save also calls the
  existing `toggleSaved`, so Saved and "Handpicked for you" stay in sync.
- `prefers-reduced-motion`: no tilt or spring, cards fade instead.

Hook loop UI:

- Progress bar "12 of 40" and a streak counter (consecutive actions without
  leaving the page).
- After every 10 actions, an interstitial "Your taste so far" card: top 3
  categories with bars, preferred time slot and price band. Tap to continue.
- End of deck: shortlist screen with this session's saves as cards, buttons
  "Plan my day with these" (links to `/plan-my-day` with the selected
  category interests preset through the existing query params), "Share on
  WhatsApp" (existing `share.ts`), "Keep swiping" (refetches next page,
  excluding seen), and "Reset my taste".

### 3. Entry points

- Nav: add "Discover" link between Explore and Categories in `Nav.tsx`.
- Home hero: a secondary button "Swipe to discover" under the search in
  `page.tsx` linking to `/discover`.

## Data flow

server page -> `fetchEvents(city, upcoming, limit 40)` -> `SwipeDeck` ->
`rankForDeck(events, useTaste())` -> user action -> `recordSignal` +
`markSeen` (+ `toggleSaved`) -> profile updates -> next card scored from new
profile on the following "Keep swiping" fetch.

## Errors and empty states

- API down: existing sample-events fallback, with the existing notice.
- Loading: skeleton card with shimmer.
- Nothing left after removing seen and past events: empty state with "Change
  city" and "Reset seen" buttons.
- localStorage unavailable (private mode errors): `createStore` already guards
  reads and writes; the deck still works, taste just does not persist.

## Testing

- Unit tests (`taste.test.ts`): weight updates per signal, clamping, price
  band and slot bucketing, cold-start score of 50, reasons text, `rankForDeck`
  excludes seen and past events and inserts explore picks.
- Browser check on the deployed preview at 1440 px and 375 px: drag save,
  drag skip, arrow keys, undo, interstitial after 10, shortlist screen,
  reduced motion.
- `npm run build` and `npm run lint` pass.
