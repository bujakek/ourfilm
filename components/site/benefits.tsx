import { Download, ShieldCheck, Smartphone, Zap } from 'lucide-react'
import { Reveal } from './reveal'

/**
 * The third card is the one to keep honest. The album has no gate — anyone
 * holding the link is in — so it may promise reachability, which is true, and
 * must not promise a password or secrecy, which are not.
 */
const benefits = [
  {
    icon: Smartphone,
    title: 'Csak egy QR-kód',
    text: 'A vendégeid beolvassák, és már tölthetik is fel a képeiket.',
  },
  {
    icon: Zap,
    title: 'Minden fotó egy helyen',
    text: 'Nem kell üzenetekből és különböző csoportokból összeszedned őket.',
  },
  {
    icon: ShieldCheck,
    title: 'Nem nyilvános',
    text: 'Az albumot az esemény linkjével vagy QR-kódjával lehet megnyitni.',
  },
  {
    icon: Download,
    title: 'Az egész album a tiéd',
    text: 'Az összes feltöltött képet egyben letöltheted.',
  },
]

export function Benefits() {
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Mindenki fotózik. Most a képek hozzád is eljutnak.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            A vendégeid feltöltik a saját fotóikat, te pedig egy közös albumban
            kapod meg őket.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={i * 90}>
              <article className="glass glass-hover flex h-full flex-col rounded-3xl p-7">
                <span className="glass flex size-12 items-center justify-center rounded-2xl">
                  <b.icon className="size-6 text-accent" strokeWidth={1.6} />
                </span>
                <h3 className="mt-6 text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {b.text}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
