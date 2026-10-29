import { useCallback, useEffect, useRef, useState } from "react";

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: FetchState<never> = { data: null, loading: true, error: null };

function isEmptyResult<T>(result: T | null): boolean {
  return result === null || (Array.isArray(result) && result.length === 0);
}

function toSettledState<T>(result: T | null, emptyMessage: string): FetchState<T> {
  if (isEmptyResult(result)) return { data: null, loading: false, error: emptyMessage };
  return { data: result, loading: false, error: null };
}

export function usePhotoFetch<T>(
  fetchPhotos: () => Promise<T | null>,
  emptyMessage: string,
  failureMessage = "Failed to fetch photos",
  // While false the hook stays loading and sends nothing, for callers that must read
  // their parameters (the URL, saved settings) before the first request.
  enabled = true,
) {
  const [state, setState] = useState<FetchState<T>>(INITIAL_STATE);
  const request = useRef(0);
  const invalidate = useCallback(() => { request.current++; }, []);

  const fetch = useCallback(async () => {
    const current = ++request.current;
    setState({ data: null, loading: true, error: null });
    try {
      const result = await fetchPhotos();
      if (current === request.current)
        setState(toSettledState(result, emptyMessage));
    } catch {
      if (current === request.current)
        setState({ data: null, loading: false, error: failureMessage });
    }
  }, [fetchPhotos, emptyMessage, failureMessage]);

  useEffect(() => {
    // Deferred to a microtask so the initial setState doesn't run
    // synchronously inside the effect body (react-hooks/set-state-in-effect).
    if (!enabled) return;
    let active = true;
    queueMicrotask(() => { if (active) void fetch(); });
    return () => { active = false; invalidate(); };
  }, [fetch, invalidate, enabled]);

  return { ...state, retry: fetch };
}
