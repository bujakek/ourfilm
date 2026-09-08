/**
 * A fine grain over the page background, and nothing else.
 *
 * This was `BackgroundGlow`: a tinted base gradient plus three drifting,
 * blurred colour blobs — lilac top-left, blue right, silver bottom. They are
 * gone, and the reason is a rule rather than a preference. **Lilac means the
 * film is live.** It belongs on a capture window that is open and a gallery
 * that has developed, and nowhere else. A page-wide lilac wash spends that
 * meaning on decoration, so by the time the guest screen says "the camera is
 * open" in the same colour, the colour has stopped saying anything.
 *
 * The base gradient went with them. It read as neutral, but `#0d0d12` is
 * R13 G13 B18 — a violet lift, the same wash an octave quieter. The design is
 * flat `#050505`, with `#0b0b0d` for anything sitting on it, and `body`
 * already carries `background-color: var(--background)`. So there is nothing
 * for this component to paint underneath any more.
 *
 * The grain stays. It is monochrome noise at 5% — texture, not colour, and the
 * one thing on this layer that a product about film should keep.
 *
 * `.grain` owns the texture itself (`app/globals.css`); this owns only the
 * fixed, inert layer it lives on.
 */
export function PageGrain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="grain absolute inset-0" />
    </div>
  )
}
