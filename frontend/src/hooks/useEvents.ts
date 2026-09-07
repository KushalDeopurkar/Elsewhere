"use client";

import { useState, useEffect, useCallback } from "react";
import { Event, SearchParams } from "@/lib/types";
import { searchEvents } from "@/lib/api";

export function useEvents(initialParams?: SearchParams) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<SearchParams>(initialParams || {});

  const fetchEvents = useCallback(async (searchParams: SearchParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchEvents(searchParams);
      setEvents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard "params changed -> refetch" effect; fetchEvents owns its
    // own loading/error/data state for this hook's callers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents(params);
  }, [params, fetchEvents]);

  const search = useCallback((newParams: Partial<SearchParams>) => {
    setParams((prev) => ({ ...prev, ...newParams, offset: 0 }));
  }, []);

  const loadMore = useCallback(() => {
    setParams((prev) => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 50),
    }));
  }, []);

  const retry = useCallback(() => {
    fetchEvents(params);
  }, [fetchEvents, params]);

  return { events, loading, error, search, loadMore, retry, params };
}
