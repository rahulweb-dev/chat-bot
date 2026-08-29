import { useEffect, useState } from "react";

// Delays reflecting `value` until it's stopped changing for `delayMs` — use for
// search inputs bound directly into a query key, so typing doesn't fire one
// network request per keystroke.
export function useDebouncedValue<T>(value: T, delayMs: number = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
