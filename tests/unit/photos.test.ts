import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `getAllEventPhotos` against a fake PostgREST.
 *
 * Worth a unit test rather than leaving it to `pnpm test:db`, because the bug
 * it guards is one no realistic fixture reproduces: PostgREST truncates an
 * unbounded select at `max_rows` (1000) and reports nothing about having done
 * it, and seeding a 2500-photo event against the remote project to notice would
 * cost more than it proves. What has to hold is the paging arithmetic, and that
 * is testable against a stub that behaves the way PostgREST does.
 *
 * The stub therefore models the two properties that actually matter: `range` is
 * inclusive at both ends, and a page never exceeds the server's own cap however
 * many rows were asked for.
 */

type Row = { id: string; created_at: string }

/** Every `range` a run asked for, so a test can assert the request pattern and
 *  not just the returned rows. */
let requested: [number, number][] = []

function fakeDatabase(rows: Row[], maxRows: number) {
  return {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        range: (from: number, to: number) => {
          requested.push([from, to])
          // PostgREST's range is inclusive, and caps the slice at max_rows
          // however wide a window the client asked for.
          const size = Math.min(to - from + 1, maxRows)
          return Promise.resolve({
            data: rows.slice(from, from + size),
            count: rows.length,
            error: null,
          })
        },
      }
      return builder
    },
  }
}

const createClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClient(),
}))

const { getAllEventPhotos } = await import('@/lib/photos')

/** `id` doubles as the index so a scrambled or short result is legible in the
 *  failure output rather than just being the wrong length. */
function photos(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
  }))
}

/** React's `cache` memoises on the argument, so every case needs its own id or
 *  it is asserting against the previous test's answer. */
let nextEventId = 0
const anEventId = () => `event-${nextEventId++}`

describe('getAllEventPhotos', () => {
  beforeEach(() => {
    requested = []
    createClient.mockReset()
  })

  it('returns an album that fits in one page, in one request', async () => {
    createClient.mockResolvedValue(fakeDatabase(photos(7), 1000))

    const result = await getAllEventPhotos(anEventId())

    expect(result).toHaveLength(7)
    expect(requested).toEqual([[0, 999]])
  })

  it('pages past max_rows instead of stopping at 1000', async () => {
    createClient.mockResolvedValue(fakeDatabase(photos(2500), 1000))

    const result = await getAllEventPhotos(anEventId())

    // The whole point: the old single unbounded select returned exactly 1000
    // here and said nothing about the other 1500.
    expect(result).toHaveLength(2500)
    expect(result.map((p) => p.id)).toEqual(photos(2500).map((p) => p.id))
    expect(requested).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('lands exactly on a page boundary without asking for a page past the end', async () => {
    createClient.mockResolvedValue(fakeDatabase(photos(2000), 1000))

    const result = await getAllEventPhotos(anEventId())

    expect(result).toHaveLength(2000)
    // A third request would be a range beyond the last row, which PostgREST
    // answers with a 416 rather than an empty page. Driving the loop on
    // `count` is what keeps it from being sent.
    expect(requested).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('still returns everything when the server caps pages lower than we ask', async () => {
    // A project whose max_rows was lowered. The short first page is not the end
    // of the album, and a "did this come back short" termination would read it
    // as one.
    createClient.mockResolvedValue(fakeDatabase(photos(1200), 400))

    const result = await getAllEventPhotos(anEventId())

    expect(result).toHaveLength(1200)
    expect(result.map((p) => p.id)).toEqual(photos(1200).map((p) => p.id))
  })

  it('handles an event with no photos at all', async () => {
    createClient.mockResolvedValue(fakeDatabase([], 1000))

    expect(await getAllEventPhotos(anEventId())).toEqual([])
    expect(requested).toEqual([[0, 999]])
  })

  it('throws rather than returning a partial album', async () => {
    createClient.mockResolvedValue({
      from: () => {
        const builder = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          range: () =>
            Promise.resolve({
              data: null,
              count: null,
              error: new Error('connection reset'),
            }),
        }
        return builder
      },
    })

    await expect(getAllEventPhotos(anEventId())).rejects.toThrow(
      'connection reset',
    )
  })
})
