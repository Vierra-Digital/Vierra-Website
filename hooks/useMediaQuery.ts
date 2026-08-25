import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query.
 *
 * Uses useSyncExternalStore, which exists for exactly this: reading a value that lives outside
 * React and changes on its own. The alternative — an effect that calls setState on mount and
 * again on every change — renders once with a placeholder value and then immediately re-renders,
 * which is what `react-hooks/set-state-in-effect` objects to, and it can tear during a concurrent
 * render because the value is read at a different time from when it is used.
 *
 * `serverValue` is what renders on the server and in the very first client render before hydration,
 * where no media query can be evaluated. Callers that need to distinguish "not known yet" from a
 * real answer should pass null and handle it; callers with a sensible default can pass false.
 */
export function useMediaQuery<T extends boolean | null>(query: string, serverValue: T): boolean | T {
  // The store type must admit serverValue too: inference from getSnapshot alone would fix it to
  // boolean and reject a null server snapshot.
  return useSyncExternalStore<boolean | T>(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}
