import { randomBytes } from 'node:crypto'

/**
 * The reference a person quotes back at us.
 *
 * Not the row's uuid: this is read off a confirmation email and sometimes
 * spelled out over the phone, so it is short and drawn from an alphabet with
 * no characters that get confused for each other — no 0/O, no 1/I/L.
 *
 * Random rather than sequential, because sequential references leak how many
 * complaints a service has received and let anyone guess a neighbour's.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LENGTH = 10

export function newPublicReference(prefix: string): string {
  const bytes = randomBytes(LENGTH)
  let out = ''
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
    if (i === 4) out += '-'
  }
  return `${prefix}-${out}`
}
