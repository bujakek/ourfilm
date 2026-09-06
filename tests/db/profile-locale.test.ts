import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  createUser,
  deleteUser,
  serviceClient,
  userClient,
  type TestUser,
} from './harness'

/**
 * The host's own language, and the escalation it must not open.
 *
 * `profiles` has no self-update policy on purpose: a host may read their role
 * and may not write it. What makes that more than a convention is that
 * 20260831150000 grants `authenticated` a blanket UPDATE on the table —
 * *every* column, `role` included. The missing policy is the only thing in the
 * way, so the obvious way to let someone switch language ("users update own
 * profile") would also make `role = 'admin'` one PATCH away for anyone holding
 * the anon key and a session.
 *
 * Hence `set_profile_locale`, a security definer function that writes one
 * named column for `auth.uid()`. The tests below pin both halves: that it
 * works, and that the door it could have opened is still shut.
 */

let host: TestUser

beforeAll(async () => {
  host = await createUser()
}, 60_000)

afterAll(async () => {
  if (host) await deleteUser(host.id)
})

async function readProfile(id: string) {
  const { data, error } = await serviceClient()
    .from('profiles')
    .select('role, locale')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

describe('profiles.locale', () => {
  it('seeds Hungarian for an account created without signup metadata', async () => {
    // `createUser` goes through the admin API, which carries no metadata —
    // the same shape as an account made from the Supabase dashboard. A null
    // here would fail the not-null constraint and take signup down with it.
    expect((await readProfile(host.id)).locale).toBe('hu')
  })

  it('seeds the locale the account signed up in', async () => {
    // What `sendSignInLink` writes on every magic link: `data: { locale }`.
    const db = serviceClient()
    const { data: created, error } = await db.auth.admin.createUser({
      email: `locale-test-${crypto.randomUUID().slice(0, 8)}@example.invalid`,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { locale: 'en' },
    })
    if (error || !created.user) throw error ?? new Error('no user')

    try {
      expect((await readProfile(created.user.id)).locale).toBe('en')
    } finally {
      await db.auth.admin.deleteUser(created.user.id)
    }
  })

  it('ignores a junk locale in metadata rather than failing the signup', async () => {
    // Metadata is not validated by Supabase, so a bad value must not be able
    // to break account creation for everyone.
    const db = serviceClient()
    const { data: created, error } = await db.auth.admin.createUser({
      email: `locale-junk-${crypto.randomUUID().slice(0, 8)}@example.invalid`,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { locale: 'klingon' },
    })
    if (error || !created.user) throw error ?? new Error('no user')

    try {
      expect((await readProfile(created.user.id)).locale).toBe('hu')
    } finally {
      await db.auth.admin.deleteUser(created.user.id)
    }
  })
})

describe('set_profile_locale', () => {
  it('changes the caller’s own language', async () => {
    const { error } = await userClient(host.accessToken).rpc(
      'set_profile_locale',
      { p_locale: 'en' },
    )
    expect(error).toBeNull()
    expect((await readProfile(host.id)).locale).toBe('en')

    await userClient(host.accessToken).rpc('set_profile_locale', {
      p_locale: 'hu',
    })
    expect((await readProfile(host.id)).locale).toBe('hu')
  })

  it('refuses a locale outside the two the product has', async () => {
    const { error } = await userClient(host.accessToken).rpc(
      'set_profile_locale',
      { p_locale: 'de' },
    )
    expect(error).not.toBeNull()
    expect((await readProfile(host.id)).locale).toBe('hu')
  })

  it('is not callable with the anon key alone', async () => {
    // The anon key ships in the browser bundle. `revoke ... from public` does
    // not remove Supabase's direct grants, which is why the migration revokes
    // from `anon, authenticated` by name — see 20260825080000.
    const { error } = await anonClient().rpc('set_profile_locale', {
      p_locale: 'en',
    })
    expect(error).not.toBeNull()
  })
})

describe('the escalation set_profile_locale exists to avoid', () => {
  it('still refuses a host writing their own role', async () => {
    // RLS makes an unauthorised UPDATE match zero rows rather than error, so
    // the row's state afterwards is what proves anything.
    await userClient(host.accessToken)
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', host.id)

    expect((await readProfile(host.id)).role).toBe('user')
  })

  it('still refuses a host writing their own locale directly', async () => {
    // The same absent policy governs every column. If this ever starts
    // passing, a self-update policy has been added and the role test above is
    // one column away from failing too.
    await userClient(host.accessToken)
      .from('profiles')
      .update({ locale: 'en' })
      .eq('id', host.id)

    expect((await readProfile(host.id)).locale).toBe('hu')
  })

  it('does not let the function be pointed at somebody else’s row', async () => {
    const other = await createUser()
    try {
      await userClient(host.accessToken).rpc('set_profile_locale', {
        p_locale: 'en',
      })
      // `auth.uid()` is read inside the function rather than accepted as an
      // argument, so there is no parameter to aim elsewhere — this asserts the
      // blast radius stayed at one row.
      expect((await readProfile(other.id)).locale).toBe('hu')
    } finally {
      await userClient(host.accessToken).rpc('set_profile_locale', {
        p_locale: 'hu',
      })
      await deleteUser(other.id)
    }
  })
})
