import { useCallback, useEffect, useState } from "react";

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
) {
  const [state, setState] = useState<FetchState<T>>(INITIAL_STATE);

  const fetch = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await fetchPhotos();
      setState(toSettledState(result, emptyMessage));
    } catch {
      setState({ data: null, loading: false, error: failureMessage });
    }
  }, [fetchPhotos, emptyMessage, failureMessage]);

  useEffect(() => {
    // Deferred to a microtask so the initial setState doesn't run
    // synchronously inside the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(fetch);
  }, [fetch]);

  return { ...state, retry: fetch };
}
