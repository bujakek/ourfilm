import type { ExportJob } from '@ourfilm/shared/export-job'
import { rm } from 'node:fs/promises'

import { complete, fail, heartbeat } from './api.ts'
import { archivePath, hasRoomFor } from './disk.ts'
import { buildArchive, uploadArchive } from './export-album.ts'
import { asWorkerFailure } from './failure.ts'
import { log } from './log.ts'

/**
 * One job, start to finish.
 *
 * Refuse it before writing if the disk cannot hold it; keep the lease alive
 * while working; build; upload; tell the server. Whatever happens, the
 * heartbeat stops and the file is deleted — the temp directory is swept on
 * boot as well, but a leak that only a restart fixes is still a leak.
 *
 * A heartbeat that answers `ok: false` means the lease is no longer ours: the
 * sweep re-queued the job after a missed heartbeat, another worker may
 * already hold it, or the event was deleted. Stop, quietly. Calling complete
 * or fail on a job somebody else owns would be worse than doing nothing.
 */
export async function runJob(job: ExportJob): Promise<void> {
  const id = job.exportId
  const file = archivePath(id)
  const total = job.manifest.entries.length

  if (!(await hasRoomFor(job.estimatedBytes))) {
    log(id, `refusing: not enough disk for ~${job.estimatedBytes} bytes`)
    await fail(id, { code: 'disk_full', retry: true })
    return
  }

  let uploadUrl: string | null = job.upload.existingUploadUrl
  let leaseLost = false
  const beat = setInterval(
    () => {
      heartbeat(id, { tusUploadUrl: uploadUrl })
        .then((answer) => {
          if (!answer.ok) {
            leaseLost = true
            log(id, `lease lost: ${answer.reason}`)
          }
        })
        .catch((error: unknown) => {
          // A missed heartbeat is not a lost lease yet; the next one may
          // land. Only the server's word ends the job.
          log(id, `heartbeat failed: ${message(error)}`)
        })
    },
    Math.max(5, job.heartbeatSeconds) * 1000,
  )

  const stillOurs = () => {
    if (leaseLost) throw new LeaseLost()
  }

  try {
    log(id, `building ${total} entries`)
    const built = await buildArchive(job, file, {
      onEntry: (done) => {
        stillOurs()
        if (done % 100 === 0) log(id, `  ${done}/${total}`)
      },
    })
    stillOurs()
    log(
      id,
      `built ${built.bytes} bytes` +
        (built.missing.length ? `, ${built.missing.length} missing` : ''),
    )

    await uploadArchive(job.upload, file, {
      onUploadUrl: (url) => {
        uploadUrl = url
      },
      onProgress: () => stillOurs(),
    })
    stillOurs()
    log(id, 'uploaded')

    const answer = await complete(id, { missingCount: built.missing.length })
    log(id, answer.ok ? 'complete' : `complete refused: ${answer.reason}`)
  } catch (error) {
    if (error instanceof LeaseLost || leaseLost) {
      log(id, 'stopping: lease no longer ours')
      return
    }
    const failure = asWorkerFailure(error)
    log(
      id,
      `failed (${failure.code}, retry=${failure.retry}): ${failure.message}`,
    )
    try {
      await fail(id, {
        code: failure.code,
        retry: failure.retry,
        detail: failure.message.slice(0, 200),
      })
    } catch (reportError) {
      log(id, `could not report failure: ${message(reportError)}`)
    }
  } finally {
    clearInterval(beat)
    await rm(file, { force: true })
  }
}

class LeaseLost extends Error {
  constructor() {
    super('lease lost')
    this.name = 'LeaseLost'
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
