'use client'

import { Printer, QrCode, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useRef } from 'react'

/** Keeps the printable QR available without making it the whole event page. */
export function QrCard({
  name,
  url,
  shots,
}: {
  name: string
  url: string
  shots: number
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="btn-shine inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        <QrCode className="size-5" strokeWidth={1.8} aria-hidden="true" />
        QR-kód
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="qr-dialog-title"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close()
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto bg-transparent p-0 text-foreground backdrop:bg-black/80"
      >
        <div className="glass-strong relative rounded-[2rem] p-3 pt-14">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="QR-kód bezárása"
            className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          <div className="print-card rounded-[1.6rem] bg-gradient-to-b from-white to-[#f2f2f5] p-8 text-center text-black">
            <p
              id="qr-dialog-title"
              className="text-2xl font-semibold tracking-tight text-balance"
            >
              {name}
            </p>
            <p className="mt-1 text-xs font-semibold tracking-[0.25em] text-black/50">
              ELDOBHATÓ KAMERA
            </p>

            <div className="my-7 flex justify-center">
              <div className="rounded-2xl bg-white p-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.4)]">
                <QRCodeSVG
                  value={url}
                  size={168}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#050505"
                />
              </div>
            </div>

            <p className="mx-auto max-w-[15rem] text-sm leading-relaxed text-black/70">
              Olvasd be a QR-kódot, és {shots} képet készíthetsz — app és
              regisztráció nélkül.
            </p>
            <div className="mt-6 border-t border-black/10 pt-4">
              <p className="truncate text-xs font-medium text-black/50">
                {url.replace('https://', '')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="glass glass-hover print-hidden mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold"
          >
            <Printer className="size-4" aria-hidden="true" />
            QR-kártya nyomtatása
          </button>
        </div>
      </dialog>
    </>
  )
}
