import { beforeAll, describe, expect, it } from 'vitest'

import { buildExportManifest, computeSourceHash } from '@/lib/album-export'
import { renderExportReadyEmail } from '@/lib/exports/email'

/**
 * The prepared-export contract's two hard edges: the claim payload has to fit
 * a Vercel response, and the hash has to move when the archive would.
 */

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'anon'
})

const event = {
  id: crypto.randomUUID(),
  slug: 'k3f9x7ab2m',
  time_zone: 'Europe/Budapest',
}

function album(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    storage_path: `${event.id}/${crypto.randomUUID()}.jpg`,
    taken_at: new Date(Date.UTC(2026, 5, 14, 14, 0, i % 60)).toISOString(),
    created_at: new Date(Date.UTC(2026, 5, 15, 8, 0, 0)).toISOString(),
    hidden_at: i % 40 === 0 ? '2026-06-15T09:00:00Z' : null,
    uploaderName: ['Kovács Réka', 'Tóth-Szabó Ádám', 'Nagymama', null][i % 4],
  }))
}

describe('the claim payload', () => {
  it('fits a 2 000-photo wedding well inside the 4.5MB function limit', () => {
    // §2.3 of docs/public-cdn-and-export-worker.md: Vercel answers 413 above
    // 4.5MB on every plan, and the biggest weddings are the ones that would
    // hit it. Assert the size here rather than discover it at a wedding.
    const manifest = buildExportManifest(event, album(2000))
    const bytes = new TextEncoder().encode(
      JSON.stringify({ job: { manifest } }),
    ).byteLength
    expect(manifest.entries).toHaveLength(2000)
    expect(bytes).toBeLessThan(2 * 1024 * 1024)
  })
})

describe('the source hash', () => {
  it('changes when a photo is hidden, and not when nothing is', async () => {
    const photos = album(5)
    const a = await computeSourceHash(photos, event.time_zone)
    const b = await computeSourceHash([...photos], event.time_zone)
    expect(b).toBe(a)

    const hidden = photos.map((p, i) =>
      i === 2 ? { ...p, hidden_at: '2026-06-16T10:00:00Z' } : p,
    )
    expect(await computeSourceHash(hidden, event.time_zone)).not.toBe(a)
    expect(await computeSourceHash(photos, 'UTC')).not.toBe(a)
  })

  it('does not depend on the order the rows arrived in', async () => {
    const photos = album(6)
    const a = await computeSourceHash(photos, event.time_zone)
    const shuffled = [...photos].reverse()
    expect(await computeSourceHash(shuffled, event.time_zone)).toBe(a)
  })
})

describe('the export-ready mail', () => {
  it('links to the host page, never to a download URL, in both languages', () => {
    for (const locale of ['hu', 'en'] as const) {
      const mail = renderExportReadyEmail({
        locale,
        eventName: 'Anna & Bence',
        url: 'https://ourfilm.app/host/events/k3f9x7ab2m?lang=' + locale,
        photoCount: 487,
      })
      expect(mail.subject).toContain('Anna & Bence')
      expect(mail.text).toContain('/host/events/k3f9x7ab2m')
      expect(mail.html).toContain('/host/events/k3f9x7ab2m')
      expect(mail.html).not.toContain('/storage/v1/object/sign')
      // No figures in the mail: a host wants to know it is ready and where
      // to tap, and the page carries the rest.
      expect(mail.text).not.toContain('487')
      expect(mail.html).not.toContain('GB')
      expect(mail.html).toContain('Anna &amp; Bence')
    }
  })
})
