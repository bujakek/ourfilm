/**
 * Where in preparation a photo failed.
 *
 * Telemetry used to say `stage: 'prepare', failure: 'invalidstateerror'` and
 * nothing more, which names the exception but not the browser API that threw
 * it. The step is the missing half: `decode` is `createImageBitmap` or
 * libheif reading the bytes, `encode` is the canvas producing a JPEG. An
 * enum, never the message — error text does not leave for PostHog.
 *
 * Isomorphic so the queue and its tests can construct and inspect one.
 */
export type PrepareStep = 'decode' | 'encode'

export class PrepareError extends Error {
  readonly step: PrepareStep

  constructor(step: PrepareStep, cause: unknown) {
    super(`Preparing a photo failed at ${step}`, { cause })
    this.name = 'PrepareError'
    this.step = step
  }
}

/** Duck-typed, like every other error check in the upload path: two copies of
 *  a module in one bundle make `instanceof` lie silently. */
export function isPrepareError(
  error: unknown,
): error is { step: PrepareStep; cause: unknown } {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'PrepareError' &&
    'step' in error
  )
}

export function prepareStepOf(error: unknown): PrepareStep | null {
  return isPrepareError(error) ? error.step : null
}

/** Run one step, tagging whatever it throws with where it was. */
export async function atStep<T>(
  step: PrepareStep,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new PrepareError(step, error)
  }
}
