'use server'

import { revalidatePath } from 'next/cache'

import { hostDisplayNameProblem } from '@/lib/host-name'
import { createClient } from '@/lib/supabase/server'

export async function updateHostDisplayName(name: string): Promise<void> {
  const displayName = name.trim()
  if (hostDisplayNameProblem(displayName)) {
    throw new Error('Adj meg egy 2–40 karakter hosszú nevet.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('A munkamenet lejárt. Jelentkezz be újra.')

  // Through the RPC rather than a PATCH on `profiles`, because the table has
  // no self-update policy and must not get one: RLS filters rows, not columns,
  // so a policy permitting this would permit `role = 'admin'` in the same
  // request. The function writes `auth.uid()` and cannot be asked for another
  // row. See `20260911061351_add_host_display_name.sql`.
  const { error } = await supabase.rpc('set_host_display_name', {
    p_name: displayName,
  })

  if (error) throw error

  // The database trigger also rewrites every existing host participant row,
  // so gallery credits change without touching individual photo records.
  revalidatePath('/host', 'layout')
}
