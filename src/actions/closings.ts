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
    p_emergency_reserve:
      reserveRaw === ''
        ? null
        : numberValue(formData, 'emergency_reserve', 0),
  })

  if (error) {
    redirect(`/fechamentos?erro=${encodeURIComponent(error.message)}`)
  }

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

  if (error) {
    redirect(
      `/fechamentos/${id}?erro=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/fechamentos')
  revalidatePath(`/fechamentos/${id}`)
  revalidatePath('/relatorios')

  redirect(
    `/fechamentos/${id}?sucesso=Fechamento+aprovado+e+repasse+agendado`,
  )
}

export async function reopenClosingAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const reason = text(formData, 'reason')

  if (!id) {
    redirect('/fechamentos?erro=Fechamento+inválido')
  }

  if (reason.length < 10) {
    redirect(
      `/fechamentos/${id}?erro=${encodeURIComponent(
        'Informe um motivo de reabertura com pelo menos 10 caracteres.',
      )}`,
    )
  }

  const { error } = await supabase.rpc('reopen_financial_closing', {
    p_closing_id: id,
    p_reason: reason,
  })

  if (error) {
    redirect(
      `/fechamentos/${id}?erro=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/fechamentos')
  revalidatePath(`/fechamentos/${id}`)
  revalidatePath('/relatorios')

  redirect(
    `/fechamentos/${id}?sucesso=${encodeURIComponent(
      'Fechamento reaberto. Corrija os lançamentos e depois clique em Recalcular fechamento.',
    )}`,
  )
}

export async function recalculateClosingAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')

  const { data: closing, error: readError } = await supabase
    .from('closings')
    .select(
      'id, client_id, period_start, period_end, emergency_reserve, status',
    )
    .eq('id', id)
    .single()

  if (readError || !closing) {
    redirect(
      `/fechamentos/${id}?erro=${encodeURIComponent(
        readError?.message ?? 'Fechamento não encontrado.',
      )}`,
    )
  }

  if (closing.status !== 'review') {
    redirect(
      `/fechamentos/${id}?erro=${encodeURIComponent(
        'Somente um fechamento em revisão pode ser recalculado por este botão.',
      )}`,
    )
  }

  const { data, error } = await supabase.rpc(
    'create_financial_closing',
    {
      p_client_id: closing.client_id,
      p_period_start: closing.period_start,
      p_period_end: closing.period_end,
      p_emergency_reserve: Number(closing.emergency_reserve ?? 0),
    },
  )

  if (error) {
    redirect(
      `/fechamentos/${id}?erro=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/fechamentos')
  revalidatePath(`/fechamentos/${id}`)
  revalidatePath('/relatorios')

  redirect(
    `/fechamentos/${data}?sucesso=${encodeURIComponent(
      'Fechamento recalculado. Confira os novos valores antes de aprovar novamente.',
    )}`,
  )
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
    redirect(
      `/fechamentos/${closingId}?erro=${encodeURIComponent(
        error instanceof Error
          ? error.message
          : 'Falha no comprovante',
      )}`,
    )
  }

  const patch: Record<string, unknown> = {
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_method: optionalText(formData, 'payment_method'),
    notes: optionalText(formData, 'notes'),
  }

  if (proofPath) {
    patch.proof_path = proofPath
  }

  const { error: payoutError } = await supabase
    .from('payouts')
    .update(patch)
    .eq('id', payoutId)

  if (payoutError) {
    redirect(
      `/fechamentos/${closingId}?erro=${encodeURIComponent(
        payoutError.message,
      )}`,
    )
  }

  const { error: closingError } = await supabase
    .from('closings')
    .update({ status: 'paid' })
    .eq('id', closingId)

  if (closingError) {
    redirect(
      `/fechamentos/${closingId}?erro=${encodeURIComponent(
        closingError.message,
      )}`,
    )
  }

  revalidatePath('/fechamentos')
  revalidatePath(`/fechamentos/${closingId}`)
  revalidatePath('/relatorios')

  redirect(
    `/fechamentos/${closingId}?sucesso=Repasse+registrado`,
  )
}
