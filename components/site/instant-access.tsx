import { Clock } from 'lucide-react'
import Image from 'next/image'
import { Reveal } from './reveal'

const arriving = [
  {
    src: '/images/wedding-cake.webp',
    alt: 'Épp most érkezett tortás fotó',
    label: 'Most érkezett',
  },
  {
    src: '/images/guests-laughing.webp',
    alt: 'Nevető vendégek fotója',
    label: '2 perce',
  },
  {
    src: '/images/evening-party.webp',
    alt: 'Esti buli fotója',
    label: '5 perce',
  },
  {
    src: '/images/group-lookout.webp',
    alt: 'Csoportkép a kilátónál',
    label: '8 perce',
  },
]

export function InstantAccess() {
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-accent">
              MÁR AZNAP
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Mire véget ér az este, a képek már együtt várnak.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-pretty text-muted-foreground">
              A vendégek már a helyszínen feltölthetik a fotóikat. Neked nem
              kell másnap egyesével elkérned őket.
            </p>
          </Reveal>

          <Reveal delay={120} className="flex justify-center">
            <div className="glass-strong w-full max-w-[300px] rounded-[2.5rem] p-2.5">
              <div className="overflow-hidden rounded-[2rem] bg-background-secondary">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <p className="text-sm font-semibold">Közös album</p>
                  <span className="flex items-center gap-1.5 text-[10px] text-accent">
                    <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                    Gyűlik
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 px-3 pb-4">
                  {arriving.map((p, i) => (
                    <div
                      key={p.src}
                      className="relative aspect-square animate-float-slow overflow-hidden rounded-xl"
                      style={{ animationDelay: `${i * -2.5}s` }}
                    >
                      <Image
                        src={p.src}
                        alt={p.alt}
                        fill
                        sizes="140px"
                        className="object-cover"
                      />
                      <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                        <Clock className="size-2.5" aria-hidden="true" />
                        {p.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
