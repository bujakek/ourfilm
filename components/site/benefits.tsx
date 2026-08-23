import { Download, ShieldCheck, Smartphone, Zap } from 'lucide-react'
import { Reveal } from './reveal'

/**
 * The third card is the one to keep honest. The album has no gate — anyone
 * holding the link is in — so it may promise reachability and non-indexing,
 * which are both true, and must not promise a password or secrecy, which are
 * not.
 */
const benefits = [
  {
    icon: Smartphone,
    title: 'Nincs letöltés',
    text: 'A vendégek a telefonjuk böngészőjéből töltenek fel. Nem kell alkalmazást telepíteniük.',
  },
  {
    icon: Zap,
    title: 'Egy közös album',
    text: 'Minden feltöltött kép ugyanabba az eseményalbumba érkezik, így nem kell őket üzenetekből és csoportokból összegyűjtened.',
  },
  {
    icon: ShieldCheck,
    title: 'Csak a meghívottaknak',
    text: 'Az albumot azok érik el, akik megkapták az esemény QR-kódját vagy meghívólinkjét. Az oldal nem jelenik meg a keresőkben.',
  },
  {
    icon: Download,
    title: 'Letöltés egyben',
    text: 'Házigazdaként egyetlen ZIP-fájlban letöltheted az esemény összes fotóját.',
  },
]

export function Benefits() {
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Egyszerű a vendégeknek. Minden kép egy helyen neked.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            A vendégeid ugyanazzal a telefonnal készítik és töltik fel a
            képeket, ami már náluk van. Nincs új alkalmazás, nincs bonyolult
            beállítás.
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
