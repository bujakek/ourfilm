/**
 * Italicises one word inside translated copy.
 *
 * Split on the word rather than storing three fragments, so the sentence stays
 * a whole sentence a translator can read and reorder. A word that is not found
 * — because the copy changed and `emphasis` did not — renders the sentence
 * plain rather than breaking it, which is the right failure for a headline.
 *
 * Lifted out of `hero.tsx` when the final CTA needed the same treatment: both
 * headlines turn on the same word, and two copies of this would eventually
 * disagree about what happens when it stops matching.
 */
export function Emphasised({ text, word }: { text: string; word: string }) {
  const at = text.indexOf(word)
  if (at === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <em className="italic">{word}</em>
      {text.slice(at + word.length)}
    </>
  )
}
