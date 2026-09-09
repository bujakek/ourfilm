/**
 * One line per stage, keyed by export id.
 *
 * Never a photo URL, an entry name or anything from the manifest: Railway's
 * logs are not a private place, and an entry name carries a guest's name.
 * The export id is a random uuid and says nothing on its own.
 */
export function log(exportId: string | null, message: string): void {
  const stamp = new Date().toISOString()
  console.log(
    exportId ? `${stamp} [${exportId}] ${message}` : `${stamp} ${message}`,
  )
}
