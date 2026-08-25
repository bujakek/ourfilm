import 'client-only'

import { prepareForUpload } from './image'

/**
 * A host's cover image, converted in the browser.
 *
 * Same reason guest photos are converted client-side: the bucket accepts only
 * `image/jpeg`, so a HEIC straight off an iPhone would be refused by a storage
 * policy rather than by anything able to explain itself. Running it through the
 * guest pipeline also strips EXIF — a cover is the most public image an event
 * has, and it should not carry the location it was taken at.
 *
 * Reuses `prepareForUpload` rather than writing a second encoder. It produces
 * three renders and only one is kept, which is a wasted resize or two on a
 * single image a host picks once; a parallel implementation that could drift
 * from the real one would cost more.
 *
 * Takes the ~1600px render, not the 4096px master. A cover is displayed at
 * roughly a phone's width and nothing prints it.
 */
export async function prepareCoverImage(file: File): Promise<File> {
  const prepared = await prepareForUpload(file)
  return new File([prepared.view], 'cover.jpg', { type: 'image/jpeg' })
}
