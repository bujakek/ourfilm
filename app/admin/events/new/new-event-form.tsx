'use client'

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import {
  DEFAULT_SHOTS,
  SHOT_OPTIONS,
  resolveRevealAt,
  validateEventDraft,
  type RevealMode,
  type ShotOption,
} from '@/lib/camera'
import {
  EVENT_TIME_ZONES,
  eventLocalToIso,
  eventTimeZoneLabel,
  formatDeadline,
} from '@/lib/format'
import { prepareCoverImage } from '@/lib/cover-image'
import { createEvent, type CreateEventState } from './actions'

const initial: CreateEventState = { error: null }

/** Event types rather than personalised titles: we have no host name to
 *  interpolate, and a type is a usable title on its own. The point is removing
 *  the blank-field pause, not writing the name for them. */
const SUGGESTIONS = [
  'Esküvő',
  'Születésnap',
  'Céges rendezvény',
  'Ballagás',
  'Évforduló',
]

const STEPS = [
  'Esemény',
  'Fotózás',
  'Leleplezés',
  'Képek',
  'Galéria',
  'Összegzés',
] as const

const LAST_STEP = STEPS.length - 1

/**
 * Six questions, one at a time.
 *
 * The whole draft lives in this component's state and posts once at the end.
 * Nothing is written per step, so backing up is free and abandoning the wizard
 * leaves nothing behind — a half-configured camera row would be a state the
 * dashboard, the QR code and the participant cap would all have to understand.
 *
 * Validation runs on every render rather than on submit, because the Next button
 * is the affordance: a host should see that a step is incomplete before they
 * reach for it, not after.
 */
export function NewEventForm({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string
  defaultEnd: string
}) {
  const [state, action, pending] = useActionState(createEvent, initial)
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [timeZone, setTimeZone] = useState(EVENT_TIME_ZONES[0] as string)
  const [captureStart, setCaptureStart] = useState(defaultStart)
  const [captureEnd, setCaptureEnd] = useState(defaultEnd)
  const [revealMode, setRevealMode] = useState<RevealMode>('event_end')
  const [customReveal, setCustomReveal] = useState(defaultEnd)
  const [shots, setShots] = useState<ShotOption>(DEFAULT_SHOTS)
  const [guestsCanView, setGuestsCanView] = useState(true)
  const [cover, setCover] = useState<{ file: File; url: string } | null>(null)
  const [coverBusy, setCoverBusy] = useState(false)

  // The blob URL is this component's to own, and a wizard that is filled in
  // twice would otherwise leak one per attempt.
  useEffect(() => {
    return () => {
      if (cover) URL.revokeObjectURL(cover.url)
    }
  }, [cover])

  const startIso = eventLocalToIso(captureStart, timeZone)
  const endIso = eventLocalToIso(captureEnd, timeZone)
  const customIso = eventLocalToIso(customReveal, timeZone)

  const problems = useMemo(
    () =>
      validateEventDraft({
        name,
        captureStartAt: startIso ? new Date(startIso) : null,
        captureEndAt: endIso ? new Date(endIso) : null,
        revealMode,
        customRevealAt: customIso ? new Date(customIso) : null,
        shotsPerParticipant: shots,
      }),
    [name, startIso, endIso, revealMode, customIso, shots],
  )

  // Which problems belong to which step, so an error shows up where it can be
  // fixed rather than on the summary at the end.
  const stepProblem = (index: number): string | null => {
    if (index === 0 && problems.includes('name_required')) {
      return 'Adj nevet az eseménynek.'
    }
    if (index === 1) {
      if (!startIso || !endIso) return 'Add meg a kezdést és a befejezést.'
      if (problems.includes('window_backwards')) {
        return 'A befejezés legyen későbbi a kezdésnél.'
      }
    }
    if (index === 2 && problems.includes('reveal_before_end')) {
      return 'A leleplezés nem lehet korábbi a fotózás végénél.'
    }
    if (index === 3 && problems.includes('invalid_shots')) {
      return 'Válassz egy értéket.'
    }
    return null
  }

  const blocked = stepProblem(step)

  const revealAt =
    startIso && endIso
      ? resolveRevealAt({
          mode: revealMode,
          captureStartAt: new Date(startIso),
          captureEndAt: new Date(endIso),
          customRevealAt: customIso ? new Date(customIso) : null,
        })
      : null

  return (
    <form action={action} className="flex flex-col gap-6">
      {/* Every value travels with the form, whichever step is on screen — a
          hidden input per field rather than re-mounting the visible ones, so
          moving between steps cannot drop an answer. */}
      <input type="hidden" name="event_name" value={name} />
      <input type="hidden" name="time_zone" value={timeZone} />
      <input type="hidden" name="capture_start_at" value={captureStart} />
      <input type="hidden" name="capture_end_at" value={captureEnd} />
      <input type="hidden" name="reveal_mode" value={revealMode} />
      <input type="hidden" name="reveal_at" value={customReveal} />
      <input type="hidden" name="shots_per_participant" value={shots} />
      {guestsCanView ? (
        <input type="hidden" name="guests_can_view" value="on" />
      ) : null}

      <StepIndicator step={step} />

      {step === 0 ? (
        <StepEvent
          name={name}
          setName={setName}
          cover={cover}
          setCover={setCover}
          coverBusy={coverBusy}
          setCoverBusy={setCoverBusy}
        />
      ) : null}

      {step === 1 ? (
        <StepWindow
          timeZone={timeZone}
          setTimeZone={setTimeZone}
          captureStart={captureStart}
          setCaptureStart={setCaptureStart}
          captureEnd={captureEnd}
          setCaptureEnd={setCaptureEnd}
        />
      ) : null}

      {step === 2 ? (
        <StepReveal
          mode={revealMode}
          setMode={setRevealMode}
          customReveal={customReveal}
          setCustomReveal={setCustomReveal}
          minReveal={captureEnd}
        />
      ) : null}

      {step === 3 ? <StepShots shots={shots} setShots={setShots} /> : null}

      {step === 4 ? (
        <StepGuests value={guestsCanView} setValue={setGuestsCanView} />
      ) : null}

      {step === LAST_STEP ? (
        <StepSummary
          name={name}
          timeZone={timeZone}
          startIso={startIso}
          endIso={endIso}
          revealMode={revealMode}
          revealAt={revealAt}
          shots={shots}
          guestsCanView={guestsCanView}
        />
      ) : null}

      {blocked ? <p className="text-destructive text-sm">{blocked}</p> : null}
      {state.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="glass glass-hover inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold"
          >
            <ArrowLeft className="size-4" />
            Vissza
          </button>
        ) : null}

        {step < LAST_STEP ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={blocked !== null || coverBusy}
            className="btn-shine inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            Tovább
            <ArrowRight className="size-5" strokeWidth={2} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending || problems.length > 0}
            className="btn-shine inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Check className="size-5" strokeWidth={2} />
            )}
            {pending ? 'Létrehozás…' : 'Esemény létrehozása'}
          </button>
        )}
      </div>
    </form>
  )
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-accent">
        {step + 1}/{STEPS.length} — {STEPS[step]}
      </p>
      {/* A row of segments rather than a single bar: it shows how many
          questions are left, which is the thing that decides whether someone
          starts filling in a form on a phone. */}
      <ol className="flex gap-1.5" aria-label="Lépések">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? 'bg-accent' : 'bg-muted-foreground/20'
            }`}
          >
            <span className="sr-only">
              {label}
              {i === step ? ' (jelenlegi)' : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function StepHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-balance">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
        {detail}
      </p>
    </div>
  )
}

function StepEvent({
  name,
  setName,
  cover,
  setCover,
  coverBusy,
  setCoverBusy,
}: {
  name: string
  setName: (v: string) => void
  cover: { file: File; url: string } | null
  setCover: (v: { file: File; url: string } | null) => void
  coverBusy: boolean
  setCoverBusy: (v: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Mi legyen az esemény neve?"
        detail="Ez a név jelenik meg a vendégeidnek."
      />

      <div>
        <label
          htmlFor="event_name_input"
          className="mb-2 block text-sm text-muted-foreground"
        >
          Esemény neve
        </label>
        <input
          id="event_name_input"
          required
          maxLength={80}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Például: Anna és Bence esküvője"
          className="glass min-h-14 w-full rounded-2xl px-5 text-base outline-none placeholder:text-muted-foreground/60 focus:border-accent"
        />

        <ul className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => setName(suggestion)}
                className="glass glass-hover min-h-11 rounded-full px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-base font-semibold">
          Adj borítóképet az eseményhez
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
          Ezt látják először a vendégeid, amikor megnyitják a meghívót.
        </p>

        {cover ? (
          <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-3xl">
            <Image
              src={cover.url}
              alt="A kiválasztott borítókép"
              fill
              sizes="(max-width: 512px) 100vw, 512px"
              unoptimized
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(cover.url)
                setCover(null)
              }}
              aria-label="Borítókép eltávolítása"
              className="glass-strong absolute top-3 right-3 flex size-11 items-center justify-center rounded-full"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={coverBusy}
            className="glass glass-hover mt-4 flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-3xl disabled:opacity-60"
          >
            {coverBusy ? (
              <Loader2 className="size-6 animate-spin text-accent" />
            ) : (
              <ImagePlus className="size-6 text-accent" strokeWidth={1.6} />
            )}
            <span className="text-sm text-muted-foreground">
              {coverBusy ? 'Feldolgozás…' : 'Kép kiválasztása — nem kötelező'}
            </span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          name="cover_source"
          accept="image/jpeg,image/png,image/webp,.heic,.heif"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return

            setCoverBusy(true)
            try {
              // Converted and downscaled here, in the browser, for the same
              // reason guest photos are: the bucket only accepts JPEG, and a
              // HEIC straight off an iPhone would be rejected by the storage
              // policy rather than by anything that could explain itself.
              const prepared = await prepareCoverImage(file)
              setCover({ file: prepared, url: URL.createObjectURL(prepared) })
            } catch (err) {
              console.error('Could not prepare cover image', err)
            } finally {
              setCoverBusy(false)
            }
          }}
        />

        {/* The prepared JPEG, not the original the host picked. Kept in a
            second input so the file that reaches the action is the one that
            was converted. */}
        <CoverField file={cover?.file ?? null} />
      </div>
    </div>
  )
}

/**
 * Puts the prepared cover File into the form's own `cover` field.
 *
 * A file input's value cannot be set from script for security reasons, so the
 * converted Blob is attached through a DataTransfer — the one supported way to
 * hand a File to a form without the user re-picking it.
 */
function CoverField({ file }: { file: File | null }) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const transfer = new DataTransfer()
    if (file) transfer.items.add(file)
    ref.current.files = transfer.files
  }, [file])

  return <input ref={ref} type="file" name="cover" className="hidden" />
}

function StepWindow({
  timeZone,
  setTimeZone,
  captureStart,
  setCaptureStart,
  captureEnd,
  setCaptureEnd,
}: {
  timeZone: string
  setTimeZone: (v: string) => void
  captureStart: string
  setCaptureStart: (v: string) => void
  captureEnd: string
  setCaptureEnd: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Mikor lehet fotózni?"
        detail="Add meg, mikortól meddig használhatják a vendégek a kamerát."
      />

      <div>
        <label
          htmlFor="capture_start_input"
          className="mb-2 block text-sm text-muted-foreground"
        >
          Kezdés
        </label>
        <input
          id="capture_start_input"
          type="datetime-local"
          value={captureStart}
          onChange={(e) => setCaptureStart(e.target.value)}
          className="glass min-h-14 w-full rounded-2xl px-5 text-base outline-none focus:border-accent"
        />
      </div>

      <div>
        <label
          htmlFor="capture_end_input"
          className="mb-2 block text-sm text-muted-foreground"
        >
          Befejezés
        </label>
        <input
          id="capture_end_input"
          type="datetime-local"
          value={captureEnd}
          min={captureStart}
          onChange={(e) => setCaptureEnd(e.target.value)}
          className="glass min-h-14 w-full rounded-2xl px-5 text-base outline-none focus:border-accent"
        />
      </div>

      <div>
        <label
          htmlFor="time_zone_input"
          className="mb-2 block text-sm text-muted-foreground"
        >
          Időzóna
        </label>
        <select
          id="time_zone_input"
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          className="glass min-h-14 w-full rounded-2xl px-5 text-base outline-none focus:border-accent"
        >
          {EVENT_TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {eventTimeZoneLabel(zone)}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          A megadott időpontokat ebben az időzónában értelmezzük.
        </p>
      </div>
    </div>
  )
}

const REVEAL_CHOICES: {
  mode: RevealMode
  title: string
  detail: string
  recommended?: boolean
}[] = [
  {
    mode: 'instant',
    title: 'Azonnal',
    detail: 'A vendégek már az esemény alatt láthatják az elkészült képeket.',
  },
  {
    mode: 'event_end',
    title: 'Az esemény végén',
    detail: 'A galéria akkor nyílik meg, amikor a fotózás véget ér.',
    recommended: true,
  },
  {
    mode: 'custom',
    title: 'Később',
    detail: 'Válassz egy későbbi időpontot a közös leleplezéshez.',
  },
]

function StepReveal({
  mode,
  setMode,
  customReveal,
  setCustomReveal,
  minReveal,
}: {
  mode: RevealMode
  setMode: (v: RevealMode) => void
  customReveal: string
  setCustomReveal: (v: string) => void
  minReveal: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Mikor jelenjenek meg a képek?"
        detail="Te döntöd el, mikor nyíljon meg a közös galéria."
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Leleplezés időpontja</legend>
        {REVEAL_CHOICES.map((choice) => (
          <label
            key={choice.mode}
            className={`glass glass-hover flex cursor-pointer gap-3 rounded-2xl p-4 ${
              mode === choice.mode ? 'border-accent' : ''
            }`}
          >
            <input
              type="radio"
              name="reveal_mode_choice"
              value={choice.mode}
              checked={mode === choice.mode}
              onChange={() => setMode(choice.mode)}
              className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="font-semibold">{choice.title}</span>
                {choice.recommended ? (
                  <span className="glass rounded-full px-2 py-0.5 text-[11px] font-medium text-accent">
                    Ajánlott
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-pretty text-muted-foreground">
                {choice.detail}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {mode === 'custom' ? (
        <div>
          <label
            htmlFor="reveal_at_input"
            className="mb-2 block text-sm text-muted-foreground"
          >
            Leleplezés időpontja
          </label>
          <input
            id="reveal_at_input"
            type="datetime-local"
            value={customReveal}
            min={minReveal}
            onChange={(e) => setCustomReveal(e.target.value)}
            className="glass min-h-14 w-full rounded-2xl px-5 text-base outline-none focus:border-accent"
          />
        </div>
      ) : null}
    </div>
  )
}

function StepShots({
  shots,
  setShots,
}: {
  shots: ShotOption
  setShots: (v: ShotOption) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Hány képet készíthet egy vendég?"
        detail="Minden résztvevő ugyanennyi felvételt kap."
      />

      <fieldset>
        <legend className="sr-only">Képek száma vendégenként</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {SHOT_OPTIONS.map((option) => {
            const active = option === shots
            return (
              <label
                key={option}
                className={`glass glass-hover flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-2xl ${
                  active ? 'border-accent' : ''
                }`}
              >
                <input
                  type="radio"
                  name="shots_choice"
                  value={option}
                  checked={active}
                  onChange={() => setShots(option)}
                  className="sr-only"
                />
                {/* The check mark carries the selection alongside the border,
                    so the choice is not signalled by colour alone. */}
                <span className="flex items-center gap-1 text-lg font-semibold">
                  {active ? (
                    <Check className="size-4 text-accent" strokeWidth={2.4} />
                  ) : null}
                  {option}
                </span>
                {option === DEFAULT_SHOTS ? (
                  <span className="mt-1 text-[11px] font-medium text-accent">
                    Ajánlott
                  </span>
                ) : null}
              </label>
            )
          })}
        </div>
      </fieldset>

      <p className="text-sm text-muted-foreground">
        A limit minden vendégnél külön számít.
      </p>
    </div>
  )
}

function StepGuests({
  value,
  setValue,
}: {
  value: boolean
  setValue: (v: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Ki láthatja a képeket?"
        detail="A szervező a saját felületén mindig eléri és moderálhatja a képeket."
      />

      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => setValue(!value)}
        className="glass glass-hover flex items-center justify-between gap-4 rounded-2xl p-4 text-left"
      >
        <span className="text-sm leading-relaxed text-pretty">
          A vendégek is megnyithatják a galériát a leleplezés után.
        </span>
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            value ? 'bg-accent' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${
              value ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </span>
      </button>
    </div>
  )
}

function StepSummary({
  name,
  timeZone,
  startIso,
  endIso,
  revealMode,
  revealAt,
  shots,
  guestsCanView,
}: {
  name: string
  timeZone: string
  startIso: string | null
  endIso: string | null
  revealMode: RevealMode
  revealAt: Date | null
  shots: ShotOption
  guestsCanView: boolean
}) {
  const revealText =
    revealMode === 'instant'
      ? 'Azonnal'
      : revealAt
        ? formatDeadline(revealAt.toISOString(), timeZone)
        : '—'

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Minden készen áll"
        detail="Nézd át, mielőtt létrehozod. Utána is bármit módosíthatsz."
      />

      <dl className="glass flex flex-col gap-3 rounded-3xl p-5 text-sm">
        <Row label="Esemény" value={name || '—'} />
        <Row
          label="Kezdés"
          value={startIso ? formatDeadline(startIso, timeZone) : '—'}
        />
        <Row
          label="Befejezés"
          value={endIso ? formatDeadline(endIso, timeZone) : '—'}
        />
        <Row label="Leleplezés" value={revealText} />
        <Row label="Képek vendégenként" value={String(shots)} />
        <Row
          label="Vendégek galériája"
          value={guestsCanView ? 'Megnyithatják' : 'Csak a szervező'}
        />
      </dl>

      {/* Every new event starts free. There is no pricing step in the middle
          of onboarding — the upgrade lives on the dashboard, where a host who
          has actually hit the cap is standing. */}
      <div className="glass flex items-start gap-3 rounded-2xl p-4">
        <Camera
          className="mt-0.5 size-5 shrink-0 text-accent"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <p className="text-sm leading-relaxed text-pretty">
          <span className="font-semibold">Ingyenes esemény</span>
          <span className="mt-0.5 block text-muted-foreground">
            Legfeljebb 5 résztvevő
          </span>
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  )
}
