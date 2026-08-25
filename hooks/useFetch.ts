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
  //
  // Updated in an effect, not during render. Writing a ref while rendering is a side effect in the
  // render phase: under StrictMode's double render or a render React throws away, it mutates state
  // that was supposed to be discarded. useRef's initial value already covers the first render, and
  // this effect is declared before the mount effect below, so it runs first and the ref is current
  // before anything reads it.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  /**
   * `skipReset` exists for the mount call below. `loading` already starts at `immediate` and
   * `error` at "", so resetting them there writes the values they already hold — and doing it
   * synchronously inside an effect is what `react-hooks/set-state-in-effect` objects to. Every
   * other caller is reacting to a user action and does want the reset.
   */
  const run = useCallback(async (skipReset = false): Promise<T | undefined> => {
    if (!skipReset) {
      setLoading(true);
      setError("");
    }
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
    // The rule flags any call from an effect that could set state synchronously; it cannot see
    // that skipReset removes the only synchronous writes, leaving setData/setLoading(false) which
    // both happen after the await. Kept as a suppression rather than restructured further, because
    // fetching on mount is exactly what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (immediate) void run(true);
    // run is stable; only fire on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, setData, loading, error, setError, run };
}
