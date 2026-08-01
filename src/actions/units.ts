'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'

export async function createPropertyAction(formData: FormData) {
  const { supabase } = await requireUser()
  const clientId = String(formData.get('client_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const city = String(formData.get('city') ?? '').trim() || null
  const state = String(formData.get('state') ?? '').trim().toUpperCase() || null
  const address = String(formData.get('address') ?? '').trim() || null

  if (!clientId || !name) redirect('/unidades?erro=Selecione+o+cliente+e+informe+o+nome+do+imóvel')

  const { error } = await supabase.from('properties').insert({
    client_id: clientId,
    name,
    city,
    state,
    address,
  })

  if (error) redirect(`/unidades?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  redirect('/unidades?sucesso=Imóvel+cadastrado')
}

export async function createUnitAction(formData: FormData) {
  const { supabase } = await requireUser()
  const propertyId = String(formData.get('property_id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const internalCode = String(formData.get('internal_code') ?? '').trim() || null
  const capacity = Number(formData.get('capacity') ?? 1)
  const rooms = Number(formData.get('rooms') ?? 1)
  const defaultRate = Number(formData.get('default_rate') ?? 0)
  const cleaningFee = Number(formData.get('cleaning_fee') ?? 0)

  if (!propertyId || !name) redirect('/unidades?erro=Selecione+o+imóvel+e+informe+o+nome+da+unidade')

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('client_id')
    .eq('id', propertyId)
    .single()

  if (propertyError || !property) redirect('/unidades?erro=Imóvel+não+encontrado')

  const { error } = await supabase.from('units').insert({
    client_id: property.client_id,
    property_id: propertyId,
    name,
    internal_code: internalCode,
    capacity,
    rooms,
    default_rate: defaultRate,
    cleaning_fee: cleaningFee,
  })

  if (error) redirect(`/unidades?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  redirect('/unidades?sucesso=Unidade+cadastrada')
}
