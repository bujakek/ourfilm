/**
 * The two shapes a text field takes on the public site, in the landing look:
 * a filled white wash with no border, like the host app's fields. Focus keeps
 * the global white `:focus-visible` outline and lifts the fill.
 */
export const inputClassName =
  'min-h-14 w-full rounded-[16px] bg-white/6 px-5 text-base font-normal text-white outline-none transition-colors placeholder:text-white/45 focus:bg-white/10 disabled:opacity-50 sm:text-sm'

export const textareaClassName =
  'w-full resize-y rounded-[16px] bg-white/6 px-5 py-4 text-base font-normal text-white outline-none transition-colors placeholder:text-white/45 focus:bg-white/10 disabled:opacity-50 sm:text-sm'
