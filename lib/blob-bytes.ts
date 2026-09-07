/**
 * Bytes, not handles.
 *
 * On iOS, the `File` a camera input hands over is a reference to a temporary
 * file, not the bytes themselves. Persisting that object to IndexedDB persists
 * the reference, and the file behind it does not outlive the page: two guest
 * photos were lost in September 2026 exactly this way. The tab died during
 * compression, the raw row came back on reload with its size intact, and
 * `createImageBitmap` threw `InvalidStateError` because there was nothing
 * left to read. Rows that had already been replaced by our own compressed
 * Blob restored fine on the same phone in the same minute.
 *
 * So the raw row must hold a copy. Reading a 3MB JPEG into memory is
 * milliseconds and is not a decode, which keeps the persist-before-decode
 * ordering the store is built on. Isomorphic on purpose — `Blob` is standard
 * in Node — so the queue's tests can exercise it.
 */

/** A fresh Blob holding the same bytes, owing nothing to the source's
 *  backing store. Throws if the source cannot be read at all. */
export async function materializeBlob(source: Blob): Promise<Blob> {
  const bytes = await source.arrayBuffer()
  return new Blob([bytes], { type: source.type })
}

/**
 * Whether a stored Blob can still be read.
 *
 * A stale handle reports its original `size`, so the store's empty check does
 * not catch it; the failure only shows when bytes are asked for. Four bytes
 * is enough to find out, and cheap enough to do on every restored row.
 */
export async function isReadable(blob: Blob): Promise<boolean> {
  try {
    await blob.slice(0, 4).arrayBuffer()
    return true
  } catch {
    return false
  }
}
