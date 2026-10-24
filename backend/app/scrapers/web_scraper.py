from __future__ import annotations
from typing import Optional, List

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import md5

import httpx
from bs4 import BeautifulSoup

from app.models.event import EventCreate, EventCategory
from app.scrapers.base import BaseScraper


@dataclass
class ScraperConfig:
    """CSS-selector-driven config for a generic web scraper."""
    name: str
    url: str
    container_selector: str
    title_selector: str
    date_selector: str
    description_selector: Optional[str] = None
    venue_selector: Optional[str] = None
    link_selector: Optional[str] = None
    link_attr: str = "href"
    image_selector: Optional[str] = None
    image_attr: str = "src"
    base_url: str = ""
    default_category: str = "other"
    default_city: Optional[str] = None


class WebScraper(BaseScraper):
    """Scrapes events from any page using CSS selectors."""

    def __init__(self, config: ScraperConfig):
        self.config = config
        self.name = config.name

    async def scrape(self, city: Optional[str] = None, **kwargs) -> List[EventCreate]:
        self._log(f"Scraping {self.config.url}")

        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                transport=httpx.AsyncHTTPTransport(retries=3),
            ) as client:
                resp = await client.get(self.config.url)
                resp.raise_for_status()
                html = resp.text
        except httpx.HTTPError as e:
            self._log(f"HTTP error: {e}")
            return []

        return self._parse_html(html)

    def _parse_html(self, html: str) -> List[EventCreate]:
        soup = BeautifulSoup(html, "lxml")
        containers = soup.select(self.config.container_selector)
        events: List[EventCreate] = []

        for container in containers:
            try:
                events.append(self._parse_container(container))
            except Exception as e:
                self._log(f"Failed to parse container: {e}")
                continue

        self._log(f"Extracted {len(events)} events")
        return events

    def _parse_container(self, el) -> EventCreate:
        cfg = self.config

        title_el = el.select_one(cfg.title_selector)
        if title_el is None:
            raise ValueError(f"Missing required title element ({cfg.title_selector})")
        title = title_el.get_text(strip=True)

        date_el = el.select_one(cfg.date_selector)
        if date_el is None:
            raise ValueError(f"Missing required date element ({cfg.date_selector})")
        date_str = date_el.get_text(strip=True)

        description = None
        if cfg.description_selector:
            desc_el = el.select_one(cfg.description_selector)
            if desc_el:
                description = desc_el.get_text(strip=True)

        venue = None
        if cfg.venue_selector:
            venue_el = el.select_one(cfg.venue_selector)
            if venue_el:
                venue = venue_el.get_text(strip=True)

        url = None
        if cfg.link_selector:
            link_el = el.select_one(cfg.link_selector)
            if link_el:
                href = link_el.get(cfg.link_attr, "")
                url = href if href.startswith("http") else f"{cfg.base_url}{href}"

        image_url = None
        if cfg.image_selector:
            img_el = el.select_one(cfg.image_selector)
            if img_el:
                src = img_el.get(cfg.image_attr, "")
                image_url = src if src.startswith("http") else f"{cfg.base_url}{src}"

        # Parse date — try ISO format first, fall back to "now" if unparseable.
        try:
            start_time = datetime.fromisoformat(date_str)
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
        except ValueError:
            start_time = datetime.now(timezone.utc)

        source_id = md5(f"{title}-{date_str}".encode()).hexdigest()

        category = EventCategory(cfg.default_category)

        return EventCreate(
            title=title,
            description=description,
            category=category,
            start_time=start_time,
            location_name=venue,
            city=cfg.default_city,
            url=url,
            image_url=image_url,
            is_free=False,
            source=cfg.name,
            source_id=source_id,
        )
