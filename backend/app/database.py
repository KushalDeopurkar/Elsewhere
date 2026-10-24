from __future__ import annotations
from typing import Optional

from supabase import create_client, Client
from app.config import get_settings

_client: Optional[Client] = None
_service_client: Optional[Client] = None


def get_supabase() -> Client:
    """Return a Supabase client using the anon key (subject to RLS)."""
    global _client
    if _client is None:
        s = get_settings()
        _client = create_client(s.supabase_url, s.supabase_key)
    return _client


def get_supabase_service() -> Client:
    """Return a Supabase client using the service role key (bypasses RLS).

    Falls back to the anon-key client when no service role key is configured,
    so the app still works during local development without one.
    """
    global _service_client
    if _service_client is None:
        s = get_settings()
        key = s.supabase_service_role_key or s.supabase_key
        _service_client = create_client(s.supabase_url, key)
    return _service_client
