import { claim } from './api.ts'
import { env } from './env.ts'
import { ensureTmpDir, sweepTmpDir } from './disk.ts'
import { log } from './log.ts'
import { runJob } from './run-job.ts'

/**
 * The export worker's loop: poll, claim, run, repeat.
 *
 * A short poll rather than a long one. Long-polling holds a Vercel function
 * open for the whole wait, and on the Hobby plan's allowance that is the
 * wrong trade; a request a minute is about a minute of compute a day, and an
 * export starting up to a minute late is invisible — the host is already
 * reading "Készül az album…". After an hour with nothing to do the interval
 * stretches to the idle backoff, and snaps back on the first job.
 *
 * One job at a time. The disk floor and the fetch concurrency are sized for
 * that, and a second job would only compete with the first for the same
 * disk and the same uplink.
 */

const IDLE_BEFORE_BACKOFF_MS = 60 * 60 * 1000

let stopping = false
let running: Promise<void> | null = null

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

async function main() {
  const config = env()
  await ensureTmpDir()
  const swept = await sweepTmpDir()
  log(null, `worker up; swept ${swept} leftover item(s) from ${config.tmpDir}`)

  let idleSince = Date.now()

  while (!stopping) {
    try {
      const job = await claim()
      if (job) {
        idleSince = Date.now()
        running = runJob(job)
        await running
        running = null
        // Something was queued; there may be more. Ask again at once.
        continue
      }
    } catch (error) {
      log(null, `loop error: ${error instanceof Error ? error.message : error}`)
    }

    if (stopping) break
    const idleFor = Date.now() - idleSince
    await sleep(
      idleFor > IDLE_BEFORE_BACKOFF_MS
        ? config.idleBackoffSeconds
        : config.pollSeconds,
    )
  }

  log(null, 'worker stopped')
}

/**
 * Railway sends SIGTERM and allows a grace period. A job mid-upload finishes
 * — its lease is being heartbeated, and abandoning it only costs the next
 * worker a rebuild — but no new job is claimed once the signal arrives.
 */
function onSignal(signal: string) {
  if (stopping) return
  stopping = true
  log(null, `${signal}: finishing the current job, claiming no more`)
  if (!running) process.exit(0)
}

process.on('SIGTERM', () => onSignal('SIGTERM'))
process.on('SIGINT', () => onSignal('SIGINT'))

main().catch((error: unknown) => {
  log(null, `fatal: ${error instanceof Error ? error.stack : error}`)
  process.exit(1)
})
