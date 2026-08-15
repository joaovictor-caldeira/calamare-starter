'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { numberValue, optionalText, text } from '@/lib/form'
import { uploadPrivateFile } from '@/lib/storage'

export async function createClosingAction(formData: FormData) {
  const { supabase } = await requireUser()
  const clientId = text(formData, 'client_id')
  const periodStart = text(formData, 'period_start')
  const periodEnd = text(formData, 'period_end')
  const reserveRaw = text(formData, 'emergency_reserve')

  if (!clientId || !periodStart || !periodEnd || periodEnd < periodStart) {
    redirect('/fechamentos?erro=Informe+cliente+e+período+válidos')
  }

  const { data, error } = await supabase.rpc('create_financial_closing', {
    p_client_id: clientId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_emergency_reserve: reserveRaw === '' ? null : numberValue(formData, 'emergency_reserve', 0),
  })

  if (error) redirect(`/fechamentos?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/fechamentos')
  revalidatePath('/relatorios')
  redirect(`/fechamentos/${data}?sucesso=Fechamento+calculado`)
}

export async function approveClosingAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')

  const { error } = await supabase.rpc('approve_financial_closing', {
    p_closing_id: id,
  })

  if (error) redirect(`/fechamentos/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/fechamentos')
  revalidatePath(`/fechamentos/${id}`)
  revalidatePath('/relatorios')
  redirect(`/fechamentos/${id}?sucesso=Fechamento+aprovado+e+repasse+agendado`)
}

export async function markPayoutPaidAction(formData: FormData) {
  const { supabase } = await requireUser()
  const payoutId = text(formData, 'payout_id')
  const closingId = text(formData, 'closing_id')

  let proofPath: string | null = null
  try {
    const proof = formData.get('proof')
    proofPath = await uploadPrivateFile(
      supabase,
      proof instanceof File ? proof : null,
      `payouts/${closingId}`,
    )
  } catch (error) {
    redirect(`/fechamentos/${closingId}?erro=${encodeURIComponent(error instanceof Error ? error.message : 'Falha no comprovante')}`)
  }

  const patch: Record<string, unknown> = {
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_method: optionalText(formData, 'payment_method'),
    notes: optionalText(formData, 'notes'),
  }
  if (proofPath) patch.proof_path = proofPath

  const { error: payoutError } = await supabase.from('payouts').update(patch).eq('id', payoutId)
  if (payoutError) redirect(`/fechamentos/${closingId}?erro=${encodeURIComponent(payoutError.message)}`)

  const { error: closingError } = await supabase.from('closings').update({ status: 'paid' }).eq('id', closingId)
  if (closingError) redirect(`/fechamentos/${closingId}?erro=${encodeURIComponent(closingError.message)}`)

  revalidatePath('/fechamentos')
  revalidatePath(`/fechamentos/${closingId}`)
  revalidatePath('/relatorios')
  redirect(`/fechamentos/${closingId}?sucesso=Repasse+registrado`)
}
