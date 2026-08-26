import { Reveal } from './reveal'

export function Benefits() {
  return (
    <section id="experience" className="relative px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-3xl">
        <Reveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Egy kamera az egész násznépnek.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
            A fotós megörökíti a nagy pillanatokat. A vendégeitek pedig mindazt,
            ami közben történik.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
