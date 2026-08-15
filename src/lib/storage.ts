import type { SupabaseClient } from '@supabase/supabase-js'

export async function uploadPrivateFile(
  supabase: SupabaseClient,
  file: File | null,
  folder: string,
) {
  if (!file || file.size === 0) return null

  const safeName = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .toLowerCase()

  const path = `${folder}/${crypto.randomUUID()}-${safeName}`
  const bytes = await file.arrayBuffer()

  const { error } = await supabase.storage
    .from('documents')
    .upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (error) throw new Error(error.message)
  return path
}

export async function signedFileUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
  expiresIn = 300,
) {
  if (!path) return null
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, expiresIn)
  if (error) return null
  return data.signedUrl
}
