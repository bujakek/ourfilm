'use client'

import { submitBillingCheckout } from '@/app/host/events/[slug]/checkout/actions'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'

const INITIAL = { error: null }

export function BillingDetailsForm({
  slug,
  defaultEmail,
}: {
  slug: string
  defaultEmail: string
}) {
  const [company, setCompany] = useState(false)
  const [state, submit, pending] = useActionState(
    submitBillingCheckout,
    INITIAL,
  )

  return (
    <form action={submit} className="glass mt-8 rounded-3xl p-5 sm:p-7">
      <input type="hidden" name="slug" value={slug} />
      <input
        type="hidden"
        name="billing_type"
        value={company ? 'company' : 'individual'}
      />

      <div className="grid gap-5">
        <Field
          label={company ? 'Cégnév' : 'Teljes név'}
          name="billing_name"
          autoComplete={company ? 'organization' : 'name'}
          required
        />

        <Field
          label="Számlázási e-mail"
          name="billing_email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          required
        />

        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field
            label="Irányítószám"
            name="billing_post_code"
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[0-9]{4}"
            maxLength={4}
            required
          />
          <Field
            label="Település"
            name="billing_city"
            autoComplete="address-level2"
            required
          />
        </div>

        <Field
          label="Közterület és házszám"
          name="billing_address"
          autoComplete="street-address"
          placeholder="Példa utca 12."
          required
        />

        <div>
          <p className="text-sm font-medium">Ország</p>
          <p className="mt-2 rounded-2xl border border-border bg-white/5 px-4 py-3 text-sm text-muted-foreground">
            Magyarország
          </p>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={company}
            onChange={(event) => setCompany(event.target.checked)}
            className="size-4 accent-current"
          />
          Céges számlát kérek
        </label>

        {company ? (
          <Field
            label="Adószám"
            name="billing_tax_number"
            placeholder="12345678-1-42"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{8}-[0-9]-[0-9]{2}"
            required
          />
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 border-t border-border pt-6">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="accept_terms"
            required
            className="mt-1 size-4 shrink-0 accent-current"
          />
          <span>
            Elolvastam és elfogadom az{' '}
            <Link
              href="/hu/aszf"
              target="_blank"
              className="font-medium text-accent underline underline-offset-2"
            >
              Általános Szerződési Feltételeket
            </Link>
            .
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="early_performance_consent"
            required
            className="mt-1 size-4 shrink-0 accent-current"
          />
          <span>
            Kérem a szolgáltatás azonnali, a 14 napos elállási időn belüli
            megkezdését, és tudomásul veszem, hogy a teljesítés megkezdésével
            elveszítem az elállási jogomat.
          </span>
        </label>
      </div>

      {state.error ? (
        <p className="mt-5 text-sm text-destructive">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn-shine mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {pending ? 'Átirányítás…' : 'Tovább a biztonságos fizetéshez'}
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
        A következő oldalon a Stripe biztonságos felületén fizethetsz.
      </p>
    </form>
  )
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  name: string
}

function Field({ label, name, ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...props}
        name={name}
        className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-white/5 px-4 text-sm text-foreground placeholder:text-muted-foreground/60"
      />
    </label>
  )
}
