import { useCallback, useRef, useInsertionEffect } from "react"

/**
 * Returns a function with a stable identity that always calls the latest
 * version of `handler`. Useful for passing callbacks into memoized children
 * (e.g. BoardSquare) where re-creating the callback every render would
 * defeat the memoization, but the callback body still needs fresh state.
 *
 * This is the escape hatch React docs describe in "Separating Events from
 * Effects" — `useEffectEvent` solves this *inside* an Effect, but it can't
 * be called from a plain event handler, so outside of Effects this ref
 * pattern is the supported workaround.
 */
export function useEventCallback<Args extends unknown[], R>(
  handler: (...args: Args) => R
): (...args: Args) => R {
  const handlerRef = useRef(handler)

  // useInsertionEffect fires before any other effect, so the ref is up to
  // date even if other layout/passive effects read it during commit.
  useInsertionEffect(() => {
    handlerRef.current = handler
  })

  return useCallback((...args: Args) => handlerRef.current(...args), [])
}
