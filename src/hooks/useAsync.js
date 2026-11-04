import { useCallback, useEffect, useRef, useState } from 'react';

// Runs an async loader and exposes loading/error state. `reload` re-runs it.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const requestId = useRef(0);

  const run = useCallback(() => {
    const currentRequest = ++requestId.current;
    setState({ data: null, loading: true, error: null });
    Promise.resolve()
      .then(loader)
      .then((data) => {
        if (requestId.current === currentRequest) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (requestId.current === currentRequest) setState({ data: null, loading: false, error });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => { requestId.current += 1; };
  }, [run]);
  return { ...state, reload: run };
}
