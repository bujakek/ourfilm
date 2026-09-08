'use client'

import { useEffect, useState } from 'react'

/**
 * Reads a value that only exists on the client — in practice, localStorage.
 *
 * Returns `serverValue` for the server render and the hydration pass, then the
 * real value immediately after mount. Pass the "hidden" variant as
 * `serverValue` so nothing flashes the wrong state before hydration settles.
 *
 * Two constraints shape this. Reading localStorage during render is a
 * hydration mismatch, and setting state synchronously in an effect body is a
 * cascading render that `react-hooks/set-state-in-effect` rejects. Deferring
 * the read into a timeout callback satisfies both: the effect body only
 * schedules, and the state lands on the next tick.
 *
 * `read` is intentionally captured once on mount rather than tracked as a
 * dependency. It is a fresh closure on every render, so depending on it would
 * re-run this effect forever; the values it closes over (an event id, a flag)
 * do not change for the lifetime of these components.
 */
export function useGuestState<T>(read: () => T, serverValue: T): T {
  const [value, setValue] = useState(serverValue)

  useEffect(() => {
    const id = setTimeout(() => setValue(read()), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [])

  return value
}
