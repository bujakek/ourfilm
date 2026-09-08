import { Quote } from 'lucide-react'
import { Reveal } from './reveal'

export interface Review {
  name: string
  date: string
  monogram: string
  quote: string
}

/**
 * What hosts said, once any of them has said it.
 *
 * The quotes and the star rating that used to live here were written, not
 * collected. They are gone rather than reworded: an invented review is the one
 * kind of landing-page copy that cannot be made honest by softening it. The
 * component takes real reviews as a prop and renders nothing without them, so
 * it is ready for the first pilot host who agrees to be quoted.
 */
export function Testimonials({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null

  return (
    <section id="testimonials" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Amit a házigazdák mondanak
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal key={r.name} delay={i * 100}>
              <figure className="glass glass-hover flex h-full flex-col rounded-2xl p-8">
                <Quote className="size-8 text-accent/60" strokeWidth={1.4} />
                <blockquote className="mt-5 flex-1 text-lg leading-relaxed text-pretty text-foreground/90">
                  {`„${r.quote}”`}
                </blockquote>
                <figcaption className="mt-7 flex items-center gap-3 border-t border-border pt-5">
                  <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-accent/30 to-accent-blue/30 text-sm font-semibold text-foreground ring-1 ring-border-strong ring-inset">
                    {r.monogram}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      {r.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {r.date}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
