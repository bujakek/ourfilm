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

  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('A név nem módosult. Próbáld újra.')
  }

  // The database trigger also rewrites every existing host participant row,
  // so gallery credits change without touching individual photo records.
  revalidatePath('/host', 'layout')
}
