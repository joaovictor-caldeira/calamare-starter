'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { numberValue, optionalText, text } from '@/lib/form'

async function validateAvailability(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  unitId: string,
  checkIn: string,
  checkOut: string,
  ignoreReservationId: string | null = null,
) {
  const { data, error } = await supabase.rpc('has_unit_block', {
    p_unit_id: unitId,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_ignore_reservation_id: ignoreReservationId,
  })

  if (error) throw new Error(error.message)
  if (data) throw new Error('Já existe reserva ou bloqueio nesse período')
}

export async function createReservationAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = text(formData, 'unit_id')
  const guestName = text(formData, 'guest_name')
  const checkIn = text(formData, 'check_in')
  const checkOut = text(formData, 'check_out')

  if (!unitId || !guestName || !checkIn || !checkOut) {
    redirect('/reservas?erro=Preencha+unidade,+hóspede,+check-in+e+check-out')
  }
  if (checkOut <= checkIn) redirect('/reservas?erro=O+check-out+deve+ser+posterior+ao+check-in')

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (unitError || !unit) redirect('/reservas?erro=Unidade+não+encontrada')

  try {
    await validateAvailability(supabase, unitId, checkIn, checkOut)
  } catch (error) {
    redirect(`/reservas?erro=${encodeURIComponent(error instanceof Error ? error.message : 'Período indisponível')}`)
  }

  const { data, error } = await supabase.from('reservations').insert({
    client_id: unit.client_id,
    unit_id: unitId,
    guest_name: guestName,
    guest_phone: optionalText(formData, 'guest_phone'),
    guest_email: optionalText(formData, 'guest_email'),
    guest_count: numberValue(formData, 'guest_count', 1),
    channel: text(formData, 'channel') || 'direct',
    external_code: optionalText(formData, 'external_code'),
    check_in: checkIn,
    check_out: checkOut,
    lodging_amount: numberValue(formData, 'lodging_amount', 0),
    cleaning_fee: numberValue(formData, 'cleaning_fee', 0),
    extra_fees: numberValue(formData, 'extra_fees', 0),
    discounts: numberValue(formData, 'discounts', 0),
    platform_commission: numberValue(formData, 'platform_commission', 0),
    status: text(formData, 'status') || 'confirmed',
    payment_status: text(formData, 'payment_status') || 'pending',
    notes: optionalText(formData, 'notes'),
  }).select('id').single()

  if (error) redirect(`/reservas?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/reservas')
  revalidatePath('/calendario')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  redirect(`/reservas/${data.id}?sucesso=Reserva+cadastrada`)
}

export async function updateReservationAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const unitId = text(formData, 'unit_id')
  const guestName = text(formData, 'guest_name')
  const checkIn = text(formData, 'check_in')
  const checkOut = text(formData, 'check_out')

  if (!id || !unitId || !guestName || !checkIn || !checkOut || checkOut <= checkIn) {
    redirect(`/reservas/${id}?erro=Dados+da+reserva+inválidos`)
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (unitError || !unit) redirect(`/reservas/${id}?erro=Unidade+não+encontrada`)

  try {
    await validateAvailability(supabase, unitId, checkIn, checkOut, id)
  } catch (error) {
    redirect(`/reservas/${id}?erro=${encodeURIComponent(error instanceof Error ? error.message : 'Período indisponível')}`)
  }

  const { error } = await supabase.from('reservations').update({
    client_id: unit.client_id,
    unit_id: unitId,
    guest_name: guestName,
    guest_phone: optionalText(formData, 'guest_phone'),
    guest_email: optionalText(formData, 'guest_email'),
    guest_count: numberValue(formData, 'guest_count', 1),
    channel: text(formData, 'channel') || 'direct',
    external_code: optionalText(formData, 'external_code'),
    check_in: checkIn,
    check_out: checkOut,
    lodging_amount: numberValue(formData, 'lodging_amount', 0),
    cleaning_fee: numberValue(formData, 'cleaning_fee', 0),
    extra_fees: numberValue(formData, 'extra_fees', 0),
    discounts: numberValue(formData, 'discounts', 0),
    platform_commission: numberValue(formData, 'platform_commission', 0),
    status: text(formData, 'status') || 'confirmed',
    payment_status: text(formData, 'payment_status') || 'pending',
    notes: optionalText(formData, 'notes'),
  }).eq('id', id)

  if (error) redirect(`/reservas/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/reservas')
  revalidatePath(`/reservas/${id}`)
  revalidatePath('/calendario')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  redirect(`/reservas/${id}?sucesso=Reserva+atualizada`)
}

export async function cancelReservationAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const id = text(formData, 'id')
  const reason = text(formData, 'cancellation_reason')

  if (!reason) redirect(`/reservas/${id}?erro=Informe+o+motivo+do+cancelamento`)

  const { error } = await supabase.from('reservations').update({
    status: 'cancelled',
    payment_status: 'cancelled',
    cancellation_reason: reason,
    cancelled_at: new Date().toISOString(),
    cancelled_by: user.id,
  }).eq('id', id)

  if (error) redirect(`/reservas/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/reservas')
  revalidatePath(`/reservas/${id}`)
  revalidatePath('/calendario')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  redirect(`/reservas/${id}?sucesso=Reserva+cancelada`)
}
