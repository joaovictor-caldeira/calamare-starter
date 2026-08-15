'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { numberValue, optionalText, text } from '@/lib/form'
import { uploadPrivateFile } from '@/lib/storage'

export async function createInventoryItemAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = text(formData, 'unit_id')
  const name = text(formData, 'name')

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (!unitId || !name || unitError || !unit) {
    redirect('/inventario?erro=Selecione+a+unidade+e+informe+o+item')
  }

  let invoicePath: string | null = null
  let photoPath: string | null = null
  try {
    const invoice = formData.get('invoice')
    const photo = formData.get('photo')
    invoicePath = await uploadPrivateFile(
      supabase,
      invoice instanceof File ? invoice : null,
      `inventory/${unit.client_id}/${unitId}/invoices`,
    )
    photoPath = await uploadPrivateFile(
      supabase,
      photo instanceof File ? photo : null,
      `inventory/${unit.client_id}/${unitId}/photos`,
    )
  } catch (error) {
    redirect(`/inventario?erro=${encodeURIComponent(error instanceof Error ? error.message : 'Falha no upload')}`)
  }

  const { data, error } = await supabase.from('inventory_items').insert({
    client_id: unit.client_id,
    unit_id: unitId,
    name,
    category: text(formData, 'category') || 'outros',
    quantity: numberValue(formData, 'quantity', 1),
    minimum_quantity: numberValue(formData, 'minimum_quantity', 0),
    condition: text(formData, 'condition') || 'good',
    purchase_date: optionalText(formData, 'purchase_date'),
    purchase_value: numberValue(formData, 'purchase_value', 0) || null,
    invoice_path: invoicePath,
    warranty_until: optionalText(formData, 'warranty_until'),
    photo_paths: photoPath ? [photoPath] : [],
    location_in_unit: optionalText(formData, 'location_in_unit'),
    notes: optionalText(formData, 'notes'),
  }).select('id').single()

  if (error) redirect(`/inventario?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/inventario')
  redirect(`/inventario/${data.id}?sucesso=Item+cadastrado`)
}

export async function updateInventoryItemAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const unitId = text(formData, 'unit_id')

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (!id || !text(formData, 'name') || unitError || !unit) {
    redirect(`/inventario/${id}?erro=Dados+do+item+inválidos`)
  }

  const patch: Record<string, unknown> = {
    client_id: unit.client_id,
    unit_id: unitId,
    name: text(formData, 'name'),
    category: text(formData, 'category') || 'outros',
    quantity: numberValue(formData, 'quantity', 1),
    minimum_quantity: numberValue(formData, 'minimum_quantity', 0),
    condition: text(formData, 'condition') || 'good',
    purchase_date: optionalText(formData, 'purchase_date'),
    purchase_value: numberValue(formData, 'purchase_value', 0) || null,
    warranty_until: optionalText(formData, 'warranty_until'),
    location_in_unit: optionalText(formData, 'location_in_unit'),
    notes: optionalText(formData, 'notes'),
    active: text(formData, 'active') !== 'false',
  }

  const { error } = await supabase.from('inventory_items').update(patch).eq('id', id)
  if (error) redirect(`/inventario/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/inventario')
  revalidatePath(`/inventario/${id}`)
  redirect(`/inventario/${id}?sucesso=Item+atualizado`)
}

export async function uploadInventoryFileAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const kind = text(formData, 'kind') === 'invoice' ? 'invoice' : 'photo'
  const entry = formData.get('file')
  const file = entry instanceof File ? entry : null

  if (!file || file.size === 0) redirect(`/inventario/${id}?erro=Selecione+um+arquivo`)

  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('client_id, unit_id, photo_paths')
    .eq('id', id)
    .single()

  if (itemError || !item) redirect(`/inventario/${id}?erro=Item+não+encontrado`)

  let path = ''
  try {
    path = await uploadPrivateFile(
      supabase,
      file,
      `inventory/${item.client_id}/${item.unit_id}/${kind}`,
    ) as string
  } catch (error) {
    redirect(`/inventario/${id}?erro=${encodeURIComponent(error instanceof Error ? error.message : 'Falha no upload')}`)
  }

  if (!path) redirect(`/inventario/${id}?erro=O+upload+não+retornou+um+caminho`)

  const patch = kind === 'invoice'
    ? { invoice_path: path }
    : { photo_paths: [...(item.photo_paths ?? []), path] }

  const { error } = await supabase.from('inventory_items').update(patch).eq('id', id)
  if (error) redirect(`/inventario/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath(`/inventario/${id}`)
  redirect(`/inventario/${id}?sucesso=Arquivo+enviado`)
}
