import { supabase } from './supabase'

/**
 * Uploads a studio logo and returns its public URL.
 *
 * The file always goes into a folder named after the workspace. The
 * storage policy checks that folder name against the caller's own
 * workspace, so it is impossible to write into someone else's.
 *
 * The filename carries a timestamp so that replacing a logo shows the
 * new one immediately instead of a cached copy of the old one.
 */
export async function uploadLogo(workspaceId, file) {
  const extension = file.name.split('.').pop().toLowerCase()
  const path = `${workspaceId}/logo-${Date.now()}.${extension}`

  const { error } = await supabase.storage.from('studio-logos').upload(path, file, {
    upsert: true,
    contentType: file.type,
  })

  if (error) throw error

  const { data } = supabase.storage.from('studio-logos').getPublicUrl(path)
  return data.publicUrl
}

/** Currencies offered in onboarding and settings. */
export const CURRENCIES = ['EGP', 'SAR', 'AED', 'USD', 'EUR', 'KWD', 'QAR', 'GBP']
