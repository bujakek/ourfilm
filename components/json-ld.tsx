/**
 * Structured data, rendered into the HTML on the server.
 *
 * `dangerouslySetInnerHTML` is the only way to put a raw JSON string inside a
 * script tag — React would otherwise escape it into something no parser reads.
 * The input is our own frontmatter, not user content, and `JSON.stringify`
 * handles the quoting; the `<` replacement closes the one hole that leaves,
 * which is a string containing `</script>`.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
