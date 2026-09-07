from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str  # anon key — used for read-only operations
    supabase_service_role_key: str = ""  # service role key — used for writes (bypasses RLS)
    eventbrite_token: str = ""
    scrape_interval_minutes: int = 60
    default_search_radius_km: float = 25.0
    max_events_per_page: int = 50
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
