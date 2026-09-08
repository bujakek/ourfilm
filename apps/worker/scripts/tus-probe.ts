/**
 * The upload experiment the export worker is built on — committed, this time.
 *
 *   pnpm --filter worker probe:tus [--mb 40] [--bucket event-exports]
 *
 * Proves, against whatever `NEXT_PUBLIC_SUPABASE_URL` points at, that a file
 * of known length can be uploaded to a private bucket over Supabase's
 * resumable (TUS) endpoint with **no credential but a signed upload token**:
 * the token `createSignedUploadUrl` returns, sent as `x-signature` to the
 * `/upload/resumable/sign` variant. That is the whole reason the worker holds
 * no Supabase key — see §2.6 of docs/public-cdn-and-export-worker.md.
 *
 * The service role is used here for exactly two things the *Vercel* side does
 * in production: minting the token, and reading the object back to check its
 * size. The upload itself carries only the token.
 *
 * Reads off the run:
 *   - that creation, every PATCH and completion succeed with the signature;
 *   - the stored size equals the sent size;
 *   - whether the signature had to accompany every chunk (it is sent on all);
 *   - the wall-clock, for the token-lifetime question.
 *
 * Refuses a non-loopback URL unless `--remote` is passed, because the hosted
 * project's bucket is a real bucket and the object is left behind on failure.
 */
import { createClient } from '@supabase/supabase-js'
import { createReadStream, statSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { Upload } from 'tus-js-client'

const args = process.argv.slice(2)
const opt = (flag: string, fallback: string) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : fallback
}
const mb = Number(opt('--mb', '40'))
const bucket = opt('--bucket', 'event-exports')
const remote = args.includes('--remote')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !serviceKey || !anonKey) {
  throw new Error(
    'Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.',
  )
}
if (!remote && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
  throw new Error(`Refusing ${url}: pass --remote to probe a hosted project.`)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

// --- the file --------------------------------------------------------------
// Random bytes so nothing along the way can compress it into a smaller test
// than the one being claimed.
const file = join(tmpdir(), `ourfilm-tus-probe-${Date.now()}.bin`)
const bytes = mb * 1024 * 1024
{
  const chunk = randomBytes(1024 * 1024)
  const parts: Buffer[] = []
  for (let i = 0; i < mb; i++) parts.push(chunk)
  writeFileSync(file, Buffer.concat(parts))
}
const size = statSync(file).size
console.log(`file: ${size} bytes`)

// --- the token: what Vercel mints at claim time ---------------------------
const objectPath = `probe/${Date.now()}/ourfilm.zip`
const { data: signed, error: signError } = await admin.storage
  .from(bucket)
  .createSignedUploadUrl(objectPath, { upsert: true })
if (signError) throw signError
console.log(`token minted for ${bucket}/${objectPath}`)

// --- the upload: what the worker does, holding only the token -------------
const endpoint = `${url}/storage/v1/upload/resumable/sign`
const started = Date.now()
let patches = 0

await new Promise<void>((resolve, reject) => {
  const upload = new Upload(createReadStream(file), {
    endpoint,
    // Fixed by Supabase. Not a tuning knob.
    chunkSize: 6 * 1024 * 1024,
    uploadSize: size,
    retryDelays: [0, 1000, 3000],
    headers: {
      apikey: anonKey,
      'x-signature': signed.token,
      'x-upsert': 'true',
    },
    metadata: {
      bucketName: bucket,
      objectName: objectPath,
      contentType: 'application/zip',
      cacheControl: '3600',
    },
    onBeforeRequest(req) {
      if (req.getMethod() === 'PATCH') patches++
    },
    onError: reject,
    onProgress(sent, total) {
      process.stdout.write(`\r  ${sent}/${total}`)
    },
    onSuccess() {
      process.stdout.write('\n')
      resolve()
    },
  })
  upload.start()
})

console.log(
  `uploaded in ${Date.now() - started}ms over ${patches} PATCH request(s)`,
)

// --- the check: what Vercel does at `complete` -----------------------------
const folder = objectPath.slice(0, objectPath.lastIndexOf('/'))
const name = objectPath.slice(objectPath.lastIndexOf('/') + 1)
const { data: listed, error: listError } = await admin.storage
  .from(bucket)
  .list(folder, { search: name })
if (listError) throw listError
const stored = listed?.find((o) => o.name === name)
const storedSize = stored?.metadata?.size
console.log(`stored: ${storedSize} bytes (expected ${size})`)

// --- tidy up ---------------------------------------------------------------
await admin.storage.from(bucket).remove([objectPath])
unlinkSync(file)

if (storedSize !== size) {
  console.error('SIZE MISMATCH')
  process.exit(1)
}
console.log('ok')
