'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { useHostToast } from '@/components/host/ui/toast'
import { SavedIndicator } from '@/components/host/ui/saved-indicator'
import {
  autosaveOutcome,
  SAVED_FLASH_MS,
  type AutosaveResult,
} from '@/lib/host-ui'
import type { Locale } from '@/lib/i18n'

type SettingsSave = {
  /**
   * Every autosaving control calls this once its action answers. `retry`
   * re-sends the value that failed; for an optimistic control it re-applies
   * the change, so the control moves again exactly as it did the first time.
   */
  report: (outcome: AutosaveResult, retry: () => void) => void
}

const SettingsSaveContext = createContext<SettingsSave | null>(null)

/**
 * The settings screen's one answer to "did that save?".
 *
 * There is no Save button anywhere on the screen, so the header carries the
 * confirmation: "✓ Mentve" for `SAVED_FLASH_MS` after each landed change, the
 * timer restarting if another lands meanwhile. A failure never flashes; it
 * shows the 7d toast with "Újra". Reverting the control is the control's own
 * job — `useOptimistic` does it for the toggles without any code.
 *
 * `header` is what sits to the left of the indicator, the back link.
 */
export function SettingsSaveProvider({
  locale,
  header,
  children,
}: {
  locale: Locale
  header?: ReactNode
  children: ReactNode
}) {
  const toast = useHostToast()
  const en = locale === 'en'
  // A counter rather than a boolean, so a second save inside the window
  // restarts the timer instead of being swallowed by the first one's.
  const [flash, setFlash] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (flash === 0) return
    const timer = window.setTimeout(() => setVisible(false), SAVED_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [flash])

  const report = useCallback(
    (outcome: AutosaveResult, retry: () => void) => {
      const next = autosaveOutcome(outcome)
      if (next.flashSaved) {
        setVisible(true)
        setFlash((n) => n + 1)
      } else {
        setVisible(false)
      }
      if (next.toast === 'retry') {
        toast.show(en ? 'Could not save' : 'Nem sikerült menteni', {
          label: en ? 'Retry' : 'Újra',
          onAction: retry,
        })
      }
    },
    [toast, en],
  )

  const value = useMemo(() => ({ report }), [report])

  return (
    <SettingsSaveContext.Provider value={value}>
      <div className="flex min-h-11 items-center justify-between gap-4">
        <div className="min-w-0">{header}</div>
        <SavedIndicator visible={visible} locale={locale} />
      </div>
      {children}
    </SettingsSaveContext.Provider>
  )
}

export function useSettingsSave(): SettingsSave {
  const value = useContext(SettingsSaveContext)
  if (!value) throw new Error('useSettingsSave needs a SettingsSaveProvider')
  return value
}
