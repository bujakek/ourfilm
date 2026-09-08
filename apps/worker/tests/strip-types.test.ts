import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `pnpm start` runs the worker under `node --experimental-strip-types`, which
 * strips type annotations and refuses any TypeScript that would need a real
 * transform — enums, namespaces, constructor parameter properties. Vitest
 * transpiles, so the other tests never notice. This one loads every module
 * the way production does, so that class of failure shows up here and not
 * on Railway.
 */
describe('strip-only mode', () => {
  const src = fileURLToPath(new URL('../src/', import.meta.url))
  const modules = readdirSync(src).filter(
    (f) => f.endsWith('.ts') && f !== 'index.ts',
  )

  for (const file of modules) {
    it(`loads src/${file}`, () => {
      const result = spawnSync(
        process.execPath,
        [
          '--experimental-strip-types',
          '--input-type=module',
          '-e',
          `await import(${JSON.stringify(new URL(file, `file://${src}`).href)})`,
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            OURFILM_API_URL: 'http://127.0.0.1:1',
            EXPORT_WORKER_SECRET: 'x',
          },
        },
      )
      expect(result.stderr.replace(/ExperimentalWarning[^\n]*\n?/g, '')).toBe(
        '',
      )
      expect(result.status).toBe(0)
    })
  }
})
