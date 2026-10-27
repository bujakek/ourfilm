import { createHash, randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { md5Hex, tileSeed } from '@/lib/tile-seed'

describe('md5Hex', () => {
  it('matches Node for the RFC vectors and for photo ids', () => {
    const inputs = [
      '',
      'a',
      'abc',
      'message digest',
      'x'.repeat(55),
      'x'.repeat(56),
      'x'.repeat(64),
      'árvíztűrő tükörfúrógép',
      ...Array.from({ length: 50 }, () => randomUUID()),
    ]
    for (const input of inputs) {
      expect(md5Hex(input)).toBe(createHash('md5').update(input).digest('hex'))
    }
  })
})

describe('tileSeed', () => {
  it('is the signed int4 Postgres derives from the first 8 hex digits', () => {
    for (let i = 0; i < 50; i++) {
      const id = randomUUID()
      const hex = createHash('md5').update(id).digest('hex').slice(0, 8)
      // `('x' || hex)::bit(32)::integer` — two's complement over 32 bits.
      const expected = Buffer.from(hex, 'hex').readInt32BE(0)
      expect(tileSeed(id)).toBe(expected)
    }
  })
})
