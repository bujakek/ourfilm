/**
 * A photo's name in analytics: the SHA-256 of its id, as lowercase hex.
 *
 * Never the id itself. The bucket is public and a photo's address is
 * `{event_id}/{photo_id}.jpg`, so a PostHog row carrying both uuids would be
 * a working link to the picture — and every event already carries
 * `event_id`. A hash of a 122-bit random id cannot be turned back into a path,
 * but anyone holding the id (an operator reading `photos`) can compute it and
 * find every report about that frame:
 *
 *     printf %s b359f2dd-9a07-4653-8c3b-78c5e2cfdce5 | shasum -a 256
 *
 * Isomorphic, because the server reports it and a test pins the value.
 * Resolves to null rather than rejecting: this only ever feeds telemetry, and
 * telemetry must not be able to fail anything.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function photoRef(
  photoId: string | null | undefined,
): Promise<string | null> {
  if (!photoId || !UUID.test(photoId)) return null
  try {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(photoId.toLowerCase()),
    )
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  } catch {
    return null
  }
}
