import { useCallback, useEffect, useRef, useState } from 'react';

const ASYNC_CACHE_TTL = 60_000;
const asyncCache = new Map();

export function invalidateAsyncCache() {
  asyncCache.clear();
}

// Cached page data is reused on navigation and refreshed without hiding the page.
export function useAsync(loader, deps = [], cacheKey = null) {
  const cached = cacheKey ? asyncCache.get(cacheKey) : null;
  const [state, setState] = useState(() => ({
    cacheKey,
    data: cached?.data ?? null,
    loading: !cached,
    error: null,
  }));
  const requestId = useRef(0);

  const run = useCallback((force = false) => {
    const currentRequest = ++requestId.current;
    const entry = cacheKey ? asyncCache.get(cacheKey) : null;
    const isFresh = entry && Date.now() - entry.savedAt < ASYNC_CACHE_TTL;
    if (isFresh && !force) {
      setState({ cacheKey, data: entry.data, loading: false, error: null });
      return;
    }

    setState({
      cacheKey,
      data: entry?.data ?? null,
      loading: !entry,
      error: null,
    });
    Promise.resolve()
      .then(() => loader(force))
      .then((data) => {
        if (requestId.current === currentRequest) {
          if (cacheKey) asyncCache.set(cacheKey, { data, savedAt: Date.now() });
          setState({ cacheKey, data, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (requestId.current === currentRequest) {
          setState({ cacheKey, data: null, loading: false, error });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, cacheKey]);

  useEffect(() => {
    run(false);
    return () => { requestId.current += 1; };
  }, [run]);

  const visibleState = state.cacheKey === cacheKey
    ? state
    : { cacheKey, data: cached?.data ?? null, loading: !cached, error: null };
  const reload = useCallback(() => run(true), [run]);
  return { ...visibleState, reload };
}
