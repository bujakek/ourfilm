'use client'

import { Download, Loader2, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'

/**
 * The "download the whole album" button, as a real client of the export route.
 *
 * It used to be a plain `<a href>`, and for a small album that was the better
 * implementation: the browser streams straight to disk, costs no memory and
 * draws its own progress. What it cannot do is tell the difference between a
 * finished archive and a truncated one. The route deliberately sends no
 * `Content-Length` (it would have to know each entry's exact stored size, and
 * `byte_size` is what the phone reported at upload rather than a measurement),
 * so the browser has nothing to check the received length against — and because
 * the 200 and the headers leave before the first photo is fetched, a function
 * that times out mid-stream produces a *successful-looking* download of a
 * half-written ZIP. On a 200-photo album that is minutes of streaming and a
 * failure the host would only discover on opening the file.
 *
 * So the fetch is done here instead, and nothing counts as success until the
 * body has been read to its end.
 *
 * Two ways to put the bytes somewhere, in order of preference:
 *
 * 1. **`showSaveFilePicker`** — writes each chunk to the file the host chose as
 *    it arrives. Keeps the streaming property the `<a href>` had, so a
 *    multi-hundred-megabyte album never exists in memory, *and* lets a torn
 *    stream be caught and the partial file discarded. Chromium only.
 * 2. **A Blob** — everywhere else, notably Safari and Firefox. This does hold
 *    the whole archive in memory before saving it, which is the honest cost of
 *    the fallback: knowing the download finished requires reading it all, and
 *    without a file handle there is nowhere to put it but memory. Acceptable
 *    because the host downloads their album on a laptop once, not on a phone at
 *    the party — and a wrong-but-quiet ZIP is the worse failure of the two.
 *
 * The `AbortError` handling follows `qr-card.tsx` and `invite-button.tsx`:
 * someone dismissing the save dialog, or cancelling their own download, has
 * completed a normal interaction and is not shown an error.
 */

/** Not in `lib.dom.d.ts` — it is File System Access, which TypeScript ships
 *  handles and writable streams for but not the picker that returns one. */
type SaveFilePicker = (options: {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
}) => Promise<FileSystemFileHandle>

const GENERIC_FAILURE = 'Nem sikerült letölteni az albumot. Próbáld újra.'

const TORN_STREAM =
  'A letöltés félbeszakadt, mielőtt az album elkészült volna. A fájl hiányos lett volna, ezért nem mentettük el — próbáld újra.'

const SESSION_LOST =
  'Úgy tűnik, lejárt a bejelentkezésed. Frissítsd az oldalt, és próbáld újra.'

/** Carries a message already written for the host, so the catch below can tell
 *  it apart from an exception that only has a developer-facing string. */
class DownloadFailure extends Error {}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function savePicker(): SaveFilePicker | null {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker })
    .showSaveFilePicker
  return typeof picker === 'function' ? picker : null
}

async function failureMessage(response: Response): Promise<string> {
  if (response.status === 404) {
    // Both of the route's 404s are already a short Hungarian sentence naming
    // the actual problem — no event, or no photos yet. Passing one through
    // beats replacing it with something vaguer.
    const text = await response.text().catch(() => '')
    const trimmed = text.trim()
    if (trimmed && trimmed.length <= 160) return trimmed
  }
  if (response.status >= 500) {
    return 'A szerver nem tudta összeállítani az albumot. Próbáld újra néhány perc múlva.'
  }
  return GENERIC_FAILURE
}

type State =
  | { phase: 'idle' }
  | { phase: 'running'; bytes: number }
  | { phase: 'failed'; message: string }

export function AlbumDownload({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  // Mirrors the `Content-Disposition` the route sets. Needed before the fetch,
  // because the save dialog has to be opened while the click still counts as a
  // user gesture, which is well before any header comes back.
  const fileName = `${slug}-ourfilm.zip`

  async function download() {
    let handle: FileSystemFileHandle | null = null
    const picker = savePicker()
    if (picker) {
      try {
        handle = await picker({
          suggestedName: fileName,
          types: [
            {
              description: 'ZIP archívum',
              accept: { 'application/zip': ['.zip'] },
            },
          ],
        })
      } catch (error) {
        // Dismissing the dialog means "not now", not "something broke".
        if (isAbort(error)) return
        // Anything else — a blocked picker, an unwritable location — is not
        // worth failing over when buffering still works.
        handle = null
      }
    }

    const controller = new AbortController()
    abortRef.current = controller
    setState({ phase: 'running', bytes: 0 })

    let writable: FileSystemWritableFileStream | null = null
    try {
      const response = await fetch(`/host/events/${slug}/export`, {
        signal: controller.signal,
      })

      if (!response.ok)
        throw new DownloadFailure(await failureMessage(response))
      // A `fetch` follows redirects silently, and `proxy.ts` answers a signed-out
      // request to any `/host` path with the login page — at status 200. Without
      // this check that HTML would be saved as the album.
      if (
        !response.headers.get('Content-Type')?.startsWith('application/zip')
      ) {
        throw new DownloadFailure(SESSION_LOST)
      }
      if (!response.body) throw new DownloadFailure(GENERIC_FAILURE)

      writable = handle ? await handle.createWritable() : null
      // `BlobPart[]` rather than `Uint8Array[]`: a `fetch` body is typed as
      // `Uint8Array<ArrayBufferLike>`, which `Blob` refuses because
      // `ArrayBufferLike` admits a `SharedArrayBuffer` — something a response
      // body is never backed by. Asserted per chunk below, because the
      // alternative is copying every chunk to re-type it and that doubles the
      // memory this branch is already spending too much of.
      const chunks: BlobPart[] = []
      const reader = response.body.getReader()
      let bytes = 0
      let shown = 0

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break

        if (writable) await writable.write(value)
        else chunks.push(value as BlobPart)

        bytes += value.byteLength
        // Re-rendering per chunk would be thousands of renders for one album.
        // The number on screen is whole megabytes, so that is what a change
        // worth reporting means.
        const mb = Math.floor(bytes / 1_000_000)
        if (mb !== shown) {
          shown = mb
          setState({ phase: 'running', bytes })
        }
      }

      // Only here is the archive known to be complete.
      if (writable) {
        await writable.close()
        writable = null
      } else {
        saveBlob(new Blob(chunks, { type: 'application/zip' }), fileName)
      }

      setState({ phase: 'idle' })
    } catch (error) {
      // A half-written file left on the host's disk under the album's own name
      // is precisely the outcome this component exists to prevent.
      if (writable) await writable.abort().catch(() => {})

      if (isAbort(error)) {
        setState({ phase: 'idle' })
        return
      }
      setState({
        phase: 'failed',
        message: error instanceof DownloadFailure ? error.message : TORN_STREAM,
      })
    } finally {
      abortRef.current = null
    }
  }

  const running = state.phase === 'running'

  return (
    <>
      <button
        type="button"
        onClick={download}
        disabled={running}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:hover:text-muted-foreground"
      >
        {running ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        {running
          ? 'Album előkészítése…'
          : state.phase === 'failed'
            ? 'Újrapróbálom'
            : 'Album letöltése'}
      </button>

      {running ? (
        <button
          type="button"
          onClick={() => abortRef.current?.abort()}
          className="min-h-11 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Mégse
        </button>
      ) : null}

      {/* `basis-full` so a message gets its own line inside the wrapping flex
          row it is dropped into, rather than squeezing the links sideways. */}
      <p
        aria-live="polite"
        className="basis-full text-center text-xs text-muted-foreground"
      >
        {running ? (
          state.bytes > 0 ? (
            <>
              {Math.floor(state.bytes / 1_000_000)} MB letöltve — hagyd nyitva
              ezt a lapot
            </>
          ) : (
            'Kapcsolódás…'
          )
        ) : null}
      </p>

      {state.phase === 'failed' ? (
        <p
          role="alert"
          className="basis-full text-center text-xs text-destructive"
        >
          <TriangleAlert
            className="mr-1 inline size-3.5 align-[-0.15em]"
            aria-hidden="true"
          />
          {state.message}
        </p>
      ) : null}
    </>
  )
}

/** Object URL, hidden `<a download>`, revoke — the same save the QR card
 *  performs, and the only route to disk a browser without the file picker
 *  offers. */
function saveBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = fileName
  link.href = objectUrl
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}
