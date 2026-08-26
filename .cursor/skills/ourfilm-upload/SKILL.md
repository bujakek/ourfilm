---
name: ourfilm-upload
description: OurFilm's client-side native-camera upload pipeline — capture input behavior, HEIC conversion, 4096px JPEG rendering, signed uploads and capture metadata. Use when building or debugging guest photography, image processing or mobile browser uploads in OurFilm.
---

> **Read this first — the disposable camera pivot changed the entry point.**
>
> The **compression policy below is unchanged and still authoritative**: 4096px
> at q0.92, HEIC converted in the browser with `heic-to`, three renders per
> photo, decoding kept strictly sequential.
>
> What changed is everything around it:
>
> - **There is no custom web camera or separate camera page.** The highlighted
>   camera action on `components/event/guest-event-view.tsx` activates one
>   hidden file input with `capture="environment"`, so a phone opens its native
>   camera UI. The input accepts one image and never advertises gallery upload.
> - **The returned camera file follows the regular decode path.**
>   `prepareForUpload()` reads its capture time before the canvas strips EXIF,
>   decodes once and produces all three renders.
> - **Uploads go to signed URLs, not to the bucket directly.** The sequence is
>   `reserve_shot` (server action, atomic, returns three signed upload URLs) →
>   PUT the three renders → `commit_shot`. Bytes still never pass through a
>   Vercel function.
> - **`taken_at` comes from the native camera file's EXIF when available.** Read
>   it before the canvas touches the file; that re-encode is a one-way door.

# OurFilm Upload Pipeline

Guests upload from a phone browser on congested venue wifi, straight to Supabase Storage — the file **never** passes through a Next.js route. Everything below runs in the browser.

## The quality policy (settled, don't renegotiate)

**4096px bounding box, JPEG quality 0.92.**

Below ~85% JPEG discards data exponentially: skin tones go blotchy and dark reception venues turn muddy and blocky. At 92% artifacting is effectively invisible, gradients stay smooth, and the image is still crisp on a Retina display or 4K TV. A 48MP iPhone photo goes from ~8MB to ~1.5–2.2MB — print-ready for the couple, and multiples faster on venue wifi.

Only `image/jpeg` reaches the bucket. The landing page's quality section depends on this: the claim is "chat apps crush your photos, we don't", **not** "we store untouched originals".

## HEIC is mandatory, not optional

Every browser except Safari fails on `.heic` — it can't decode, preview, or process it. Since uploads bypass the server, conversion must happen client-side, before compression.

Use **`heic-to`** (built on libheif 1.18), not `heic2any` — the latter drags in 600KB+ of WebAssembly. Either way, **import it dynamically, only when a HEIC file actually appears**, so the bundle isn't paid for by guests whose phones send JPEG:

```bash
pnpm add heic-to
```

```ts
// HEIC often arrives with an empty MIME type — check the extension too.
function isHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

async function toJpegBlob(file: File): Promise<Blob> {
  if (!isHeic(file)) return file
  const { heicTo } = await import('heic-to')
  return heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
}
```

Second line of defense: on iOS, a file input whose `accept` list excludes HEIC often makes Safari transcode to JPEG on the way out. Set `accept="image/jpeg,image/png,image/webp,.heic,.heif"` so nothing is silently unselectable, and keep the conversion path regardless — never rely on the browser doing it.

## Compression

```ts
const MAX_EDGE = 4096
const QUALITY = 0.92

export async function prepareForUpload(file: File) {
  const source = await toJpegBlob(file)

  // from-image bakes EXIF orientation into the pixels, so the canvas
  // re-encode can't leave the photo sideways.
  const bitmap = await createImageBitmap(source, {
    imageOrientation: 'from-image',
  })

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close() // release before the next file; phones are memory-tight

  const blob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: QUALITY,
  })
  return { blob, width, height }
}
```

Notes:

- Never upscale — `Math.min(1, …)` keeps small photos untouched in size.
- If the output ends up larger than the input and the input was already JPEG under the cap, upload the original instead.
- `OffscreenCanvas` is well supported on modern iOS/Android; fall back to a detached `<canvas>` + `toBlob` if you need older Safari.
- Capping the **long edge** at 4096 keeps total canvas area under iOS Safari's ~16.7M pixel ceiling (a 4:3 photo lands near 12.6M). Don't raise the cap without rechecking that.
- The canvas re-encode drops all EXIF, including GPS coordinates. That's a privacy win — don't re-attach it.
- It also drops the **HDR gain map**, which is why a re-encoded iPhone photo looks flat next to the original on an HDR screen. A gain map is a second image referenced by MPF offsets in `APP2`; canvas only ever sees tone-mapped SDR pixels, so no canvas setting recovers it. Preserving it means not re-encoding at all — see ticket 3.8.
- Ask the 2D context for `colorSpace: 'display-p3'`. The default is sRGB, which clips everything a phone camera captures outside it. Confirm by profile size: Chrome writes 456 bytes for sRGB and ~520 for Display P3.
- Process files **sequentially** (or two at a time at most). A parallel loop over ten 48MP photos will crash mobile Safari.

## Upload

Generate the id client-side so the storage path and the database row agree:

```ts
const supabase = createGuestClient() // lib/supabase/client.ts — not createClient(); that one rides the host session
const photoId = crypto.randomUUID()
const path = `${eventId}/${photoId}.jpg`

const { error: uploadError } = await supabase.storage
  .from('event-photos')
  .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
if (uploadError) throw uploadError

const { error: insertError } = await supabase.from('photos').insert({
  id: photoId,
  event_id: eventId,
  storage_path: path,
  uploader_name: uploaderName || null,
  width,
  height,
  byte_size: blob.size,
  mime_type: 'image/jpeg',
  taken_at: takenAt?.toISOString() ?? null,
})
if (insertError) throw insertError
```

The reverse trip matters just as much: the **export** writes the time back into
the file (`lib/exif-write.ts`), because a date held only in the database is
invisible to Photos, Lightroom and Finder. A ZIP entry's timestamp does not
substitute — it becomes the file's modification date, and Photos reads
`DateTimeOriginal`, falling back to the creation date, i.e. when the archive was
unzipped. Time tags only; never write a location back.

**Read the capture time before you touch the pixels.** `readCaptureTime()` in
`lib/exif.ts` must run on the original `File`; the canvas re-encode below is what
strips EXIF, and after it there is nothing left to read. This is a one-way door
— a photo uploaded without its capture time can never get it back.

Order matters: upload the object first, insert the row second. A failed insert leaves an orphaned object (harmless, cleanable); the reverse would put a broken tile in the gallery.

Guests are anonymous, so RLS allows insert only — see `ourfilm-supabase` for the policies and the upload window.

## Progress and retry

`supabase-js` `.upload()` gives no byte-level progress. For the MVP, show **per-file status** instead, which is what the Hungarian copy promises:

`várakozik → előkészítés → feltöltés → kész | hiba`

Keep one state object per selected file (`id`, `previewUrl`, `status`, `error`) and render a list. If true byte-level percentage is ever needed, create a signed upload URL and `PUT` it with `XMLHttpRequest` to get `upload.onprogress` — only do that if a real device test shows the staged states aren't reassuring enough.

On failure, set `status: 'hiba'` and show a retry button that re-runs the single file. **Manual retry only** — automatic background/resumable upload is explicitly out of scope, and the landing copy was rewritten to match.

Other essentials:

- Revoke every `URL.createObjectURL` preview in a cleanup effect.
- Keep the optional `uploader_name` in `localStorage` so a guest types their nickname once per device.
- Disable the picker while the queue is running, and never navigate away mid-upload without a confirmation.
- Success state must be unmistakable and celebratory — this is the moment the pilot is measuring.

## Test on a real phone before shipping

Simulators do not reproduce HEIC, camera pickers, or slow wifi. Minimum matrix: iPhone Safari (HEIC path), Android Chrome (JPEG path), one multi-select of 10+ photos, and one throttled connection.
