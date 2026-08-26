/**
 * A linter for product claims the pivot made false.
 *
 * OurFilm used to be an upload album with a five-photo free tier and an
 * unlimited paid one. It is now a shared digital disposable camera: the cap is
 * on *participants*, every guest gets a fixed roll, and guests shoot into the
 * camera at the event rather than uploading a camera roll afterwards. Copy
 * that says otherwise is not a typo — it is a promise the product cannot keep,
 * and it survives in a repository precisely because nobody re-reads sixty-nine
 * pages looking for it.
 *
 * The hard part is that these words are *fine* about somebody else. A
 * comparison page that says a competitor offers unlimited photos is accurate
 * and has to stay. So a finding needs three things at once: the sentence must
 * be about OurFilm, it must contain a stale claim, and it must not be denying
 * it — every one of these pages contains sentences like "az OurFilm nem
 * egyszerű feltöltőmappa", which is the correction, not the defect.
 */

interface StaleClaim {
  /** What the copy must not say about OurFilm. */
  pattern: RegExp
  /** What is wrong with it, for the failure message. */
  reason: string
}

const STALE_CLAIMS: StaleClaim[] = [
  {
    pattern: /korlátlan(?:ul)?\s+(?:fotó|kép|felvétel|fénykép)/i,
    reason:
      'every guest gets a fixed roll of 5/10/16/24/36 — only the guest count is uncapped',
  },
  {
    pattern: /\b5\s*(?:fotó|kép|feltöltött\s+fotó)(?:ig)?\b[^.]*ingyen/i,
    reason: 'the free tier is 5 participants, not 5 photos',
  },
  {
    pattern: /(?:egyszerű|sima)\s+feltöltő(?:album|mappa|felület)/i,
    reason: 'OurFilm is a shared camera, not an upload album',
  },
  {
    pattern: /kameratekercs|camera\s*roll/i,
    reason:
      'guests shoot into the event camera; there is no camera-roll upload',
  },
  {
    pattern: /utólag(?:os)?\s+(?:tölt|feltölt)/i,
    reason: 'guests shoot during the capture window, not afterwards',
  },
]

/** Words that turn a claim into its own denial. A sentence carrying one is
 *  correcting the misconception rather than repeating it — and a question mark
 *  means the sentence is an FAQ heading, whose answer follows separately. */
const NEGATORS =
  /\bnem\b|\bnincs\b|\bnincsen\b|\bsem\b|\bhelyett\b|\bnélkül\b|\?/i

export interface ClaimFinding {
  /** The passage as it appears in the file. */
  text: string
  /** What is wrong with it. */
  reason: string
}

const OURFILM = /OurFilm/i

function cells(row: string): string[] {
  return row.split('|').map((cell) => cell.trim())
}

const isTableRow = (line: string) => line.trim().startsWith('|')
const isSeparatorRow = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line)

/**
 * Every passage of a document that is speaking **about OurFilm**.
 *
 * Three ways a passage can be ours, and all three are needed:
 *
 * - it names us — an ordinary sentence containing "OurFilm";
 * - it sits under a heading that names us — `## Mit ad az OurFilm?` is
 *   followed by bullets that never repeat the name;
 * - it is our column of a comparison table — `| Képlimit | … | … |` says
 *   "OurFilm" only in the header row, so a claim in the wrong cell would
 *   otherwise read as a competitor's and pass.
 *
 * Sentences are split out of prose so a paragraph that mentions us and a
 * competitor cannot launder one into the other.
 */
function ourFilmPassages(markdown: string): string[] {
  const passages: string[] = []
  const lines = markdown.split('\n')

  // Which column of the table currently being read is ours, if any.
  let ourColumn: number | null = null
  let headingIsOurs = false

  for (const line of lines) {
    if (line.startsWith('#')) {
      headingIsOurs = OURFILM.test(line)
      ourColumn = null
      continue
    }

    if (isTableRow(line)) {
      if (isSeparatorRow(line)) continue

      const row = cells(line)

      if (ourColumn === null) {
        // First non-separator row of a table is its header.
        const index = row.findIndex((cell) => OURFILM.test(cell))
        if (index !== -1) ourColumn = index
        continue
      }

      const cell = row[ourColumn]
      if (cell) passages.push(cell)
      continue
    }

    ourColumn = null

    if (!line.trim()) continue

    for (const sentence of line.split(/(?<=[.!?;])\s+/)) {
      const text = sentence.trim()
      if (!text) continue
      if (headingIsOurs || OURFILM.test(text)) passages.push(text)
    }
  }

  return passages
}

/** Every stale OurFilm claim in a body of Hungarian copy. Empty is a pass. */
export function findStaleClaims(markdown: string): ClaimFinding[] {
  const findings: ClaimFinding[] = []

  for (const text of ourFilmPassages(markdown)) {
    if (NEGATORS.test(text)) continue

    for (const claim of STALE_CLAIMS) {
      if (claim.pattern.test(text)) {
        findings.push({ text, reason: claim.reason })
      }
    }
  }

  return findings
}
