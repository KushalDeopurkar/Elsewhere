<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/PostGIS-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostGIS" />
  <img src="https://img.shields.io/badge/MapLibre-396CB2?style=for-the-badge&logo=maplibre&logoColor=white" alt="MapLibre" />
</p>

# 🎯 EventEngine

**Discover what's worth showing up for — across India.**

EventEngine is a full-stack event discovery platform that aggregates events from multiple sources across 22+ Indian cities, with natural-language search, interactive map exploration, and smart categorization.

> 🔗 **Live:** [event-discovery-engine.vercel.app](https://event-discovery-engine.vercel.app)

---

## What It Does

EventEngine scrapes public event listings from sources like **AllEvents.in**, **District.in**, and **Meetup**, deduplicates them, and surfaces them through a clean interface with two core views:

- **Search & Browse** — natural-language queries like *"free tech meetups in Bengaluru"* or *"beginner-friendly design workshops"*, filtered by date, category, and city
- **Map View** — spatial exploration powered by MapLibre GL + PostGIS, showing events plotted on an interactive map with category filters

Events are organized into 12 categories: Technology & AI, Startups & Business, Education & Learning, Arts & Culture, Sports & Fitness, Music, Community & Social, Food & Drink, Lifestyle & Wellbeing, Travel & Outdoors, Family & Kids, and Nightlife.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                  │     │                  │     │                  │
│   Next.js 16     │────▶│   FastAPI        │────▶│   Supabase       │
│   (Vercel)       │     │   (Render)       │     │   (PostGIS)      │
│                  │     │                  │     │                  │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
               AllEvents    District.in    Meetup
               Scraper       Scraper       Scraper
```

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, MapLibre GL, Motion | UI with map, search, animations |
| Backend | FastAPI, httpx, BeautifulSoup, APScheduler | API + scraping engine |
| Database | Supabase (PostgreSQL + PostGIS) | Geospatial event store with full-text search |
| CI/CD | GitHub Actions (every 6h) | Automated scraping pipeline |

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, scheduler, startup
│   │   ├── api/events.py        # REST endpoints (search, ingest, bounds)
│   │   ├── scrapers/
│   │   │   ├── allevents.py     # AllEvents.in — Schema.org JSON-LD parser
│   │   │   ├── district.py      # District.in — category page scraper (22 cities)
│   │   │   └── meetup.py        # Meetup — Apollo cache parser
│   │   ├── models.py            # Pydantic schemas
│   │   └── database.py          # Supabase client
│   ├── run_scrapers.py          # CLI for manual scraping
│   └── requirements.txt
│
├── frontend/
│   ├── app/                     # Next.js app router pages
│   ├── components/              # React components
│   └── package.json
│
├── supabase/
│   └── migrations/
│       └── 001_create_events.sql  # Full schema: PostGIS, RLS, indexes, RPC functions
│
├── .github/
│   └── workflows/
│       └── scrape-events.yml    # Cron scraping (every 6h) + manual dispatch
│
└── SCRAPING.md                  # Setup guide for running scrapers locally
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Database Setup

Create a Supabase project, then run the migration in the SQL editor:

```sql
-- paste contents of supabase/migrations/001_create_events.sql
```

This sets up PostGIS, the `events` table with geospatial columns, full-text search vectors, RLS policies, spatial indexes, and three RPC functions (`search_events`, `get_event_by_id`, `events_in_bounds`).

### 2. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Create .env
cat > .env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF

# Start the server
uvicorn app.main:app --reload --port 8000
```

### 3. Run Scrapers

```bash
# Scrape all sources for all cities
python run_scrapers.py --source all

# Scrape a specific source and city
python run_scrapers.py --source district --city mumbai

# Dry run (no DB writes)
python run_scrapers.py --source allevents --dry-run
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `BACKEND_URL` in your environment to point to your backend (defaults to the deployed Render URL).

---

## Scrapers

| Source | Strategy | Cities |
|--------|----------|--------|
| **AllEvents.in** | Parses `application/ld+json` Schema.org blocks from listing pages | 22 Indian cities |
| **District.in** | Parses JSON-LD `ItemList` from category pages, falls back to HTML link extraction | 22 Indian cities |
| **Meetup** | Extracts events from Next.js `__NEXT_DATA__` Apollo cache | 22 Indian cities |

Each scraper is resilient to missing data and respects rate limits with configurable delays. Events are deduplicated on `(source, source_id)` — running the same scrape twice won't create duplicates.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/events/search` | Full-text search with geo, category, and time filters |
| `GET` | `/api/events/{id}` | Single event by UUID |
| `GET` | `/api/events/bounds` | Events within a map bounding box |
| `POST` | `/api/events/ingest` | Trigger scraping (optional `city` param) |

---

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | **Vercel** | Auto-deploys from `main` branch |
| Backend | **Render** | Set Supabase env vars |
| Database | **Supabase** | Free tier, PostGIS enabled |
| Scraping | **GitHub Actions** | Runs every 6 hours via cron |

The GitHub Actions workflow also supports manual dispatch with source selection (`all`, `allevents`, `district`, `meetup`), optional city targeting, and dry-run mode.

---

## Tech Stack

**Frontend:** Next.js 16 · React 19 · Tailwind CSS 4 · MapLibre GL · Motion · Phosphor Icons · Bricolage Grotesque + Geist fonts

**Backend:** FastAPI · httpx · BeautifulSoup · lxml · APScheduler · Pydantic · Supabase Python SDK

**Database:** PostgreSQL (Supabase) · PostGIS · Full-text search (tsvector) · Row-Level Security

---

## Roadmap

- [x] **Core MVP** — search, browse, map, multi-source scraping
- [ ] **Intelligence Layer** — AI-powered event recommendations, similarity matching
- [ ] **Alerts & Notifications** — email/push alerts for new events matching user preferences
- [ ] **More Scrapers** — BookMyShow, Townscript, Eventbrite (if API returns)
- [ ] **User Accounts** — save events, preferences, personalized feed

---

## License

Built for the hackathon. See [SCRAPING.md](SCRAPING.md) for notes on data source terms.

---

<p align="center">
  <b>Built with ☕ in Mumbai</b>
</p>
