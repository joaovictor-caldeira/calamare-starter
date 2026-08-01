'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'

export async function createReservationAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = String(formData.get('unit_id') ?? '')
  const guestName = String(formData.get('guest_name') ?? '').trim()
  const guestPhone = String(formData.get('guest_phone') ?? '').trim() || null
  const channel = String(formData.get('channel') ?? 'direct')
  const checkIn = String(formData.get('check_in') ?? '')
  const checkOut = String(formData.get('check_out') ?? '')
  const lodgingAmount = Number(formData.get('lodging_amount') ?? 0)
  const cleaningFee = Number(formData.get('cleaning_fee') ?? 0)
  const platformCommission = Number(formData.get('platform_commission') ?? 0)
  const status = String(formData.get('status') ?? 'confirmed')

  if (!unitId || !guestName || !checkIn || !checkOut) {
    redirect('/reservas?erro=Preencha+unidade,+hóspede,+check-in+e+check-out')
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    redirect('/reservas?erro=O+check-out+deve+ser+posterior+ao+check-in')
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (unitError || !unit) redirect('/reservas?erro=Unidade+não+encontrada')

  const { data: overlaps } = await supabase
    .from('reservations')
    .select('id')
    .eq('unit_id', unitId)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)
    .limit(1)

  if (overlaps && overlaps.length > 0) {
    redirect('/reservas?erro=Já+existe+reserva+ou+bloqueio+nesse+período')
  }

  const { error } = await supabase.from('reservations').insert({
    client_id: unit.client_id,
    unit_id: unitId,
    guest_name: guestName,
    guest_phone: guestPhone,
    channel,
    check_in: checkIn,
    check_out: checkOut,
    lodging_amount: lodgingAmount,
    cleaning_fee: cleaningFee,
    platform_commission: platformCommission,
    status,
    payment_status: 'pending',
  })

  if (error) redirect(`/reservas?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/reservas')
  revalidatePath('/calendario')
  revalidatePath('/dashboard')
  redirect('/reservas?sucesso=Reserva+cadastrada')
}
