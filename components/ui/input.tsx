/**
 * The three shapes a text field takes, and none of them is `.glass` any more.
 *
 * A filled, blurred surface was the same material the cards, the tiles, the
 * chips and the secondary buttons wore, which is how a screen ended up with
 * eight of them and no hierarchy. A field is a place to type: a 1px outline on
 * the page background says that, costs no compositing, and leaves `.glass` to
 * mean "inert secondary surface".
 *
 * Focus keeps the global `:focus-visible` ring from `globals.css` and takes
 * `border-strong` rather than `border-accent` — lilac now means the film is
 * live, and a focused field is not that.
 */
export const inputClassName =
  'min-h-14 w-full rounded-md border border-border bg-transparent px-5 text-base font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-strong disabled:opacity-50 sm:text-sm'

export const textareaClassName =
  'w-full resize-y rounded-md border border-border bg-transparent px-5 py-4 text-base font-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-strong disabled:opacity-50 sm:text-sm'

export const inputSurfaceClassName =
  'flex min-h-14 items-center gap-3 rounded-md border border-border px-5 transition-colors focus-within:border-strong'
