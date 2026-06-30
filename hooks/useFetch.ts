import { useCallback, useEffect, useRef, useState } from "react";

interface UseFetchOptions {
  /** Run the fetcher once on mount. Default false. */
  immediate?: boolean;
  /** Fallback message when the thrown error has none. */
  errorMessage?: string;
}

/**
 * Standard data-fetching state machine extracted from the panel components,
 * which all re-implemented `setLoading(true) / try / catch -> setError / finally`.
 *
 *   const { data, loading, error, run } = useFetch(
 *     async () => { const r = await fetch("/api/x"); if (!r.ok) throw new Error("Failed"); return r.json(); },
 *     { immediate: true }
 *   );
 */
export function useFetch<T>(fetcher: () => Promise<T>, options: UseFetchOptions = {}) {
  const { immediate = false, errorMessage = "Something went wrong" } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string>("");

  // Keep the latest fetcher without making `run` change identity every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (): Promise<T | undefined> => {
    setLoading(true);
    setError("");
    try {
      const result = await fetcherRef.current();
      setData(result);
      return result;
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : errorMessage);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (immediate) void run();
    // run is stable; only fire on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, setData, loading, error, setError, run };
}
