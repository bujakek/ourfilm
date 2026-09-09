'use client'

import { Check, Download, QrCode, Share2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useRef, useState } from 'react'

import { Sheet } from '@/components/host/sheet'
import type { Locale } from '@/lib/i18n'
import { downloadQrCanvas } from '@/lib/qr-file'
import { shareEventLink } from '@/lib/share-link'
import { track } from '@/lib/telemetry'

/**
 * The QR code, one tap from the host's camera.
 *
 * It sits where the guest's share button sits — a 58px square beside the
 * shutter — because the two screens are the same screen with different
 * privileges, and a host who has just taken a photo of the room is one tap
 * from the thing that gets everybody else shooting.
 *
 * The sheet rises from the bottom on a phone (`Sheet` anchors itself there)
 * and carries both ways the code leaves this page: the PNG for printing, and
 * the address for a chat. `lib/share-link.ts` says why those are two buttons
 * and not one.
 *
 * The canvas is 1024px whatever it is displayed at, so what downloads is print
 * resolution. It is mounted only while the sheet is open — an offscreen 1024px
 * canvas on a page a host leaves open all evening is a megabyte of texture
 * doing nothing.
 */
export function QrSheetButton({
  name,
  url,
  eventId,
  shots,
  locale,
}: {
  name: string
  url: string
  /** Telemetry only — the printed URL itself never leaves the page. */
  eventId: string
  shots: number
  locale: Locale
}) {
  const en = locale === 'en'
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)

  async function share() {
    const outcome = await shareEventLink({ url, title: name })
    if (outcome === 'dismissed') return
    if (outcome === 'clipboard') {
      // The label is the only receipt a clipboard copy leaves — a share sheet
      // announces itself, and a silent copy does not.
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    }
    track('invite_shared', {
      event_id: eventId,
      surface: 'host',
      method: outcome,
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={en ? 'QR code and link' : 'QR-kód és link'}
        className="flex size-[58px] shrink-0 items-center justify-center rounded-lg border border-white/15 text-foreground/60 transition-colors hover:border-white/30 hover:text-foreground"
      >
        <QrCode className="size-[19px]" strokeWidth={1.8} aria-hidden="true" />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={en ? 'Close QR code' : 'QR-kód bezárása'}
        title={en ? 'QR code' : 'QR-kód'}
        // Pinned, not scrolled past. The card below is a whole printed ticket
        // and on a small phone it fills the panel on its own.
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadQrCanvas(canvas.current, name)}
              className="hover:border-strong flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition-colors"
            >
              <Download className="size-4" aria-hidden="true" />
              {en ? 'Save QR code' : 'QR-kód mentése'}
            </button>
            <button
              type="button"
              onClick={share}
              className="hover:border-strong flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition-colors"
            >
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Share2 className="size-4" aria-hidden="true" />
              )}
              {copied
                ? en
                  ? 'Link copied'
                  : 'Link kimásolva'
                : en
                  ? 'Share link'
                  : 'Link megosztása'}
            </button>
          </div>
        }
      >
        <div className="paper rounded-2xl p-6 text-center">
          <p className="font-display text-[24px] leading-[1.1] text-balance">
            {name}
          </p>
          <p className="paper-muted mt-1.5 font-mono text-[9px] font-medium tracking-[0.22em]">
            {en ? 'DISPOSABLE CAMERA' : 'ELDOBHATÓ KAMERA'}
          </p>

          <div className="my-5 flex justify-center">
            <div className="rounded-sm bg-white p-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.4)]">
              <QRCodeCanvas
                ref={canvas}
                value={url}
                size={1024}
                level="M"
                bgColor="#ffffff"
                fgColor="#050505"
                marginSize={4}
                style={{ height: 176, width: 176 }}
              />
            </div>
          </div>

          <p className="paper-muted mx-auto max-w-[15rem] text-[13px] leading-relaxed">
            {en
              ? `Scan the QR code and take ${shots} photos — no app or account needed.`
              : `Olvasd be a QR-kódot, és készíts akár ${shots} képet. Nem kell hozzá app vagy regisztráció.`}
          </p>

          {/* Wrapping, not truncating. This is the address a guest types when
              the camera will not scan, so an ellipsis in the middle of it
              defeats the one job the code has. */}
          <div className="paper-rule mt-4 border-t pt-3">
            <p className="paper-muted font-mono text-[10px] leading-snug break-all">
              {url.replace('https://', '')}
            </p>
          </div>
        </div>
      </Sheet>
    </>
  )
}
