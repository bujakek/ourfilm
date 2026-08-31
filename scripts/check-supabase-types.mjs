import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const mode = process.argv[2]

if (mode !== 'local' && mode !== 'linked') {
  console.error('Usage: node scripts/check-supabase-types.mjs <local|linked>')
  process.exit(2)
}

const generated = spawnSync(
  'pnpm',
  ['exec', 'supabase', 'gen', 'types', 'typescript', `--${mode}`],
  {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  },
)

if (generated.status !== 0) {
  process.stderr.write(generated.stderr)
  process.exit(generated.status ?? 1)
}

const committed = readFileSync('lib/supabase/database.types.ts', 'utf8')
const expected = normalize(committed)
const actual = normalize(generated.stdout)

if (expected === actual) {
  console.log(`types match the ${mode} schema`)
  process.exit(0)
}

const expectedLines = expected.split('\n')
const actualLines = actual.split('\n')
let firstDifference = 0

while (
  firstDifference < expectedLines.length &&
  firstDifference < actualLines.length &&
  expectedLines[firstDifference] === actualLines[firstDifference]
) {
  firstDifference += 1
}

const lineNumber = firstDifference + 1

console.error(
  `Database types are stale (first difference at line ${lineNumber}).`,
)
console.error('Run `pnpm types:gen`, commit the result, and try again.')
console.error(`Committed: ${expectedLines[firstDifference] ?? '<end of file>'}`)
console.error(`Generated: ${actualLines[firstDifference] ?? '<end of file>'}`)
process.exit(1)

function normalize(source) {
  const lines = source.replaceAll('\r\n', '\n').split('\n')
  const output = []
  let skippingInternalMetadata = false

  for (const line of lines) {
    if (
      line.startsWith(
        '  // Allows to automatically instantiate createClient with right options',
      )
    ) {
      skippingInternalMetadata = true
      continue
    }

    if (skippingInternalMetadata) {
      if (line === '  }') skippingInternalMetadata = false
      continue
    }

    output.push(line.trimEnd())
  }

  return output.join('\n').trimEnd()
}
