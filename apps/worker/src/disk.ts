import { mkdir, readdir, rm, statfs } from 'node:fs/promises'
import { join } from 'node:path'

import { env } from './env.ts'

/**
 * Disk is a correctness concern here, not a resource.
 *
 * The archive is built in full on the ephemeral disk before it is uploaded —
 * that is what gives the upload a known length, and with it a real resume —
 * so a job must be refused before a byte is written if the disk cannot hold
 * it, and whatever a dead container left behind must be swept on boot. A
 * leak here is invisible until the disk is full and every job fails.
 */

export async function freeBytes(dir: string): Promise<number> {
  const stats = await statfs(dir)
  return Number(stats.bavail) * Number(stats.bsize)
}

export async function ensureTmpDir(): Promise<string> {
  const dir = env().tmpDir
  await mkdir(dir, { recursive: true })
  return dir
}

/**
 * Remove anything a previous container left in the temp directory.
 *
 * Every archive is written under its export id, so nothing in here is worth
 * keeping across a restart: a job that was mid-build has lost its lease by
 * the time a new container is up, and will be rebuilt from scratch by
 * whichever worker claims it next.
 */
export async function sweepTmpDir(): Promise<number> {
  const dir = await ensureTmpDir()
  const entries = await readdir(dir, { withFileTypes: true })
  let removed = 0
  for (const entry of entries) {
    await rm(join(dir, entry.name), { recursive: true, force: true })
    removed += 1
  }
  return removed
}

/** Whether a job estimated at `estimatedBytes` fits with the floor to spare. */
export async function hasRoomFor(
  estimatedBytes: number,
  read: (dir: string) => Promise<number> = freeBytes,
  floorBytes: number = env().diskFloorBytes,
  dir: string = env().tmpDir,
): Promise<boolean> {
  const free = await read(dir)
  return free - estimatedBytes > floorBytes
}

/** Where one job's archive is written. */
export function archivePath(exportId: string): string {
  return join(env().tmpDir, `${exportId}.zip`)
}
