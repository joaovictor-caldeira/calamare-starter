'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { numberValue, optionalText, text } from '@/lib/form'

export async function createPropertyAction(formData: FormData) {
  const { supabase } = await requireUser()
  const clientId = text(formData, 'client_id')
  const name = text(formData, 'name')

  if (!clientId || !name) redirect('/unidades?erro=Selecione+o+cliente+e+informe+o+nome+do+imóvel')

  const { data, error } = await supabase.from('properties').insert({
    client_id: clientId,
    name,
    internal_code: optionalText(formData, 'internal_code'),
    city: optionalText(formData, 'city'),
    state: optionalText(formData, 'state')?.toUpperCase(),
    address: optionalText(formData, 'address'),
    location_url: optionalText(formData, 'location_url'),
    notes: optionalText(formData, 'notes'),
  }).select('id').single()

  if (error) redirect(`/unidades?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  redirect(`/imoveis/${data.id}?sucesso=Imóvel+cadastrado`)
}

export async function updatePropertyAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const clientId = text(formData, 'client_id')
  const name = text(formData, 'name')

  if (!id || !clientId || !name) redirect('/unidades?erro=Dados+do+imóvel+incompletos')

  const { error } = await supabase.from('properties').update({
    client_id: clientId,
    name,
    internal_code: optionalText(formData, 'internal_code'),
    city: optionalText(formData, 'city'),
    state: optionalText(formData, 'state')?.toUpperCase(),
    address: optionalText(formData, 'address'),
    location_url: optionalText(formData, 'location_url'),
    notes: optionalText(formData, 'notes'),
  }).eq('id', id)

  if (error) redirect(`/imoveis/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  revalidatePath(`/imoveis/${id}`)
  redirect(`/imoveis/${id}?sucesso=Imóvel+atualizado`)
}

export async function setPropertyStatusAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const id = text(formData, 'id')
  const status = text(formData, 'status') === 'active' ? 'active' : 'inactive'

  const { error } = await supabase.from('properties').update({
    status,
    inactivated_at: status === 'inactive' ? new Date().toISOString() : null,
    inactivated_by: status === 'inactive' ? user.id : null,
  }).eq('id', id)

  if (error) redirect(`/imoveis/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  revalidatePath(`/imoveis/${id}`)
  redirect(`/imoveis/${id}?sucesso=${status === 'active' ? 'Imóvel+reativado' : 'Imóvel+inativado'}`)
}

export async function createUnitAction(formData: FormData) {
  const { supabase } = await requireUser()
  const propertyId = text(formData, 'property_id')
  const name = text(formData, 'name')

  if (!propertyId || !name) redirect('/unidades?erro=Selecione+o+imóvel+e+informe+o+nome+da+unidade')

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('client_id')
    .eq('id', propertyId)
    .single()

  if (propertyError || !property) redirect('/unidades?erro=Imóvel+não+encontrado')

  const { data, error } = await supabase.from('units').insert({
    client_id: property.client_id,
    property_id: propertyId,
    name,
    internal_code: optionalText(formData, 'internal_code'),
    capacity: numberValue(formData, 'capacity', 1),
    rooms: numberValue(formData, 'rooms', 1),
    beds: numberValue(formData, 'beds', 1),
    default_rate: numberValue(formData, 'default_rate', 0),
    cleaning_fee: numberValue(formData, 'cleaning_fee', 0),
    security_deposit: numberValue(formData, 'security_deposit', 0),
    check_in_time: text(formData, 'check_in_time') || '14:00',
    check_out_time: text(formData, 'check_out_time') || '11:00',
    notes: optionalText(formData, 'notes'),
  }).select('id').single()

  if (error) redirect(`/unidades?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  redirect(`/unidades/${data.id}?sucesso=Unidade+cadastrada`)
}

export async function updateUnitAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const propertyId = text(formData, 'property_id')
  const name = text(formData, 'name')

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('client_id')
    .eq('id', propertyId)
    .single()

  if (!id || !name || propertyError || !property) redirect(`/unidades/${id}?erro=Dados+da+unidade+inválidos`)

  const { error } = await supabase.from('units').update({
    client_id: property.client_id,
    property_id: propertyId,
    name,
    internal_code: optionalText(formData, 'internal_code'),
    capacity: numberValue(formData, 'capacity', 1),
    rooms: numberValue(formData, 'rooms', 1),
    beds: numberValue(formData, 'beds', 1),
    default_rate: numberValue(formData, 'default_rate', 0),
    cleaning_fee: numberValue(formData, 'cleaning_fee', 0),
    security_deposit: numberValue(formData, 'security_deposit', 0),
    check_in_time: text(formData, 'check_in_time') || '14:00',
    check_out_time: text(formData, 'check_out_time') || '11:00',
    wifi_name: optionalText(formData, 'wifi_name'),
    wifi_password: optionalText(formData, 'wifi_password'),
    door_code: optionalText(formData, 'door_code'),
    access_instructions: optionalText(formData, 'access_instructions'),
    airbnb_url: optionalText(formData, 'airbnb_url'),
    booking_url: optionalText(formData, 'booking_url'),
    direct_booking_url: optionalText(formData, 'direct_booking_url'),
    notes: optionalText(formData, 'notes'),
  }).eq('id', id)

  if (error) redirect(`/unidades/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  revalidatePath(`/unidades/${id}`)
  redirect(`/unidades/${id}?sucesso=Unidade+atualizada`)
}

export async function setUnitStatusAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const id = text(formData, 'id')
  const status = text(formData, 'status') === 'active' ? 'active' : 'inactive'

  const { error } = await supabase.from('units').update({
    status,
    inactivated_at: status === 'inactive' ? new Date().toISOString() : null,
    inactivated_by: status === 'inactive' ? user.id : null,
  }).eq('id', id)

  if (error) redirect(`/unidades/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  revalidatePath(`/unidades/${id}`)
  redirect(`/unidades/${id}?sucesso=${status === 'active' ? 'Unidade+reativada' : 'Unidade+inativada'}`)
}

export async function deleteEmptyPropertyAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const { count } = await supabase.from('units').select('id', { count: 'exact', head: true }).eq('property_id', id)
  if ((count ?? 0) > 0) redirect(`/imoveis/${id}?erro=O+imóvel+possui+unidades.+Use+inativação`)

  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) redirect(`/imoveis/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  redirect('/unidades?sucesso=Imóvel+excluído')
}

export async function deleteEmptyUnitAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')

  const [{ count: reservations }, { count: expenses }, { count: cleaning }, { count: maintenance }] = await Promise.all([
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('unit_id', id),
    supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('unit_id', id),
    supabase.from('cleaning_tasks').select('id', { count: 'exact', head: true }).eq('unit_id', id),
    supabase.from('maintenance_tickets').select('id', { count: 'exact', head: true }).eq('unit_id', id),
  ])

  if ((reservations ?? 0) + (expenses ?? 0) + (cleaning ?? 0) + (maintenance ?? 0) > 0) {
    redirect(`/unidades/${id}?erro=A+unidade+possui+histórico.+Use+inativação`)
  }

  const { error } = await supabase.from('units').delete().eq('id', id)
  if (error) redirect(`/unidades/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/unidades')
  redirect('/unidades?sucesso=Unidade+excluída')
}
