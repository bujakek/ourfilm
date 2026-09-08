import type { ExportFailureCode } from '@ourfilm/shared/export-job'

/**
 * A job failure the worker can name.
 *
 * `retry` is the worker's opinion, not its decision: the server owns the
 * attempt budget and the backoff (`fail_album_export`), so all the worker
 * says is whether this looked transient. Disk, network and upload failures
 * usually are; an archive that could not be assembled from what it was given
 * usually is not.
 */
export class WorkerFailure extends Error {
  // Explicit fields, not parameter properties: strip-only mode cannot run
  // the latter. See `ApiError`.
  readonly code: ExportFailureCode
  readonly retry: boolean

  constructor(
    code: ExportFailureCode,
    retry: boolean,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'WorkerFailure'
    this.code = code
    this.retry = retry
  }
}

/** Anything thrown, reduced to a failure the server understands. */
export function asWorkerFailure(error: unknown): WorkerFailure {
  if (error instanceof WorkerFailure) return error
  if (isDiskFull(error)) {
    return new WorkerFailure('disk_full', true, 'no space left on device', {
      cause: error,
    })
  }
  const message = error instanceof Error ? error.message : String(error)
  return new WorkerFailure('unknown', false, message, { cause: error })
}

export function isDiskFull(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOSPC'
  )
}
