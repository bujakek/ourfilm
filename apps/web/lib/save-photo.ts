import 'client-only'

/**
 * Put one photo where the host can keep it.
 *
 * Two paths, because "save" means two different things on the two devices a
 * host uses. On a desktop it is a file in Downloads, and the `?download=` URL
 * (`lib/photo-urls.ts`) is the whole mechanism. On a phone it is a picture in
 * Photos, and an attachment does not get there: iOS Safari renders a
 * `Content-Disposition: attachment` in a viewer, so a plain link leaves the
 * host looking at their own photo with no way to keep it but a long press.
 *
 * So on a device with a share sheet the bytes are fetched and handed over as a
 * `File`, which is what puts "Save Image" in front of them. It costs one
 * download of the master into memory — a couple of megabytes, once, on a
 * deliberate tap.
 *
 * Falls through rather than failing: a share sheet that refuses files, a fetch
 * that will not complete, a browser with neither, all end at the link.
 */
export type SaveOutcome = 'share_sheet' | 'download' | 'dismissed'

export async function savePhoto({
  url,
  filename,
  title,
}: {
  /** The `?download=` URL. Used verbatim for the link, and fetched for the
   *  share sheet — the header it carries is harmless to a `fetch`. */
  url: string
  filename: string
  title: string
}): Promise<SaveOutcome> {
  if (navigator.share && navigator.canShare) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const file = new File([await response.blob()], filename, {
          type: 'image/jpeg',
        })
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title })
            return 'share_sheet'
          } catch (error) {
            // Closing the sheet is a complete, normal outcome. Falling through
            // to a download here would hand the host a file they just declined.
            if (error instanceof DOMException && error.name === 'AbortError') {
              return 'dismissed'
            }
          }
        }
      }
    } catch {
      // Offline, blocked, out of memory on a large master. The link still works.
    }
  }

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  return 'download'
}
