'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { numberValue, optionalText, text } from '@/lib/form'

export async function createClientAction(formData: FormData) {
  const { supabase } = await requireUser()
  const name = text(formData, 'name')

  if (!name) redirect('/clientes?erro=O+nome+do+cliente+é+obrigatório')

  const { data, error } = await supabase.from('clients').insert({
    name,
    email: optionalText(formData, 'email'),
    phone: optionalText(formData, 'phone'),
    cpf_cnpj: optionalText(formData, 'cpf_cnpj'),
    address: optionalText(formData, 'address'),
    management_fee_type: text(formData, 'management_fee_type') || 'percentage',
    management_fee_value: numberValue(formData, 'management_fee', 0),
    management_fee_base: text(formData, 'management_fee_base') || 'net_channels',
    emergency_reserve_default: numberValue(formData, 'emergency_reserve_default', 0),
    closing_day: numberValue(formData, 'closing_day', 15),
    payout_day: numberValue(formData, 'payout_day', 20),
    notes: optionalText(formData, 'notes'),
  }).select('id').single()

  if (error) redirect(`/clientes?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/clientes')
  redirect(`/clientes/${data.id}?sucesso=Cliente+cadastrado`)
}

export async function updateClientAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const name = text(formData, 'name')

  if (!id || !name) redirect('/clientes?erro=Dados+do+cliente+incompletos')

  const { error } = await supabase.from('clients').update({
    name,
    email: optionalText(formData, 'email'),
    phone: optionalText(formData, 'phone'),
    cpf_cnpj: optionalText(formData, 'cpf_cnpj'),
    address: optionalText(formData, 'address'),
    bank_details: optionalText(formData, 'bank_details'),
    management_fee_type: text(formData, 'management_fee_type') || 'percentage',
    management_fee_value: numberValue(formData, 'management_fee', 0),
    management_fee_base: text(formData, 'management_fee_base') || 'net_channels',
    emergency_reserve_default: numberValue(formData, 'emergency_reserve_default', 0),
    closing_day: numberValue(formData, 'closing_day', 15),
    payout_day: numberValue(formData, 'payout_day', 20),
    notes: optionalText(formData, 'notes'),
  }).eq('id', id)

  if (error) redirect(`/clientes/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  redirect(`/clientes/${id}?sucesso=Dados+atualizados`)
}

export async function setClientStatusAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const id = text(formData, 'id')
  const status = text(formData, 'status') === 'active' ? 'active' : 'inactive'

  const { error } = await supabase.from('clients').update({
    status,
    inactivated_at: status === 'inactive' ? new Date().toISOString() : null,
    inactivated_by: status === 'inactive' ? user.id : null,
  }).eq('id', id)

  if (error) redirect(`/clientes/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  redirect(`/clientes/${id}?sucesso=${status === 'active' ? 'Cliente+reativado' : 'Cliente+inativado'}`)
}

export async function deleteEmptyClientAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')

  const [{ count: properties }, { count: reservations }, { count: expenses }] = await Promise.all([
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('client_id', id),
  ])

  if ((properties ?? 0) + (reservations ?? 0) + (expenses ?? 0) > 0) {
    redirect(`/clientes/${id}?erro=O+cliente+possui+dados+vinculados.+Use+inativação`)
  }

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) redirect(`/clientes/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/clientes')
  redirect('/clientes?sucesso=Cliente+excluído')
}
