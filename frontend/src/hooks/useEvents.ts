"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchEvents } from "@/lib/api";
import { Event, SearchParams } from "@/lib/types";

interface State {
  events: Event[];
  loading: boolean;
  error: string | null;
  isSample: boolean;
}

export function useEvents(initial: SearchParams = {}) {
  const [state, setState] = useState<State>({
    events: [],
    loading: true,
    error: null,
    isSample: false,
  });

  // Held in a ref so run() stays stable and retry() can replay the last query.
  const params = useRef<SearchParams>(initial);
  // Guards against an earlier, slower request overwriting a later one.
  const requestId = useRef(0);

  const run = useCallback(async (next: SearchParams) => {
    params.current = next;
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const { events, isSample } = await searchEvents(next);
      if (id !== requestId.current) return;
      setState({ events, loading: false, error: null, isSample });
    } catch (err) {
      if (id !== requestId.current) return;
      setState({
        events: [],
        loading: false,
        error: err instanceof Error ? err.message : "Something went wrong",
        isSample: false,
      });
    }
  }, []);

  useEffect(() => {
    run(params.current);
  }, [run]);

  const search = useCallback(
    (patch: SearchParams) => run({ ...params.current, ...patch }),
    [run],
  );

  const retry = useCallback(() => run(params.current), [run]);

  return { ...state, search, retry };
}
