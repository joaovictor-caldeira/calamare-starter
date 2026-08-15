'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { checkbox, numberValue, optionalText, text } from '@/lib/form'
import { uploadPrivateFile } from '@/lib/storage'

export async function createExpenseAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = text(formData, 'unit_id')
  const categoryId = text(formData, 'category_id')
  const description = text(formData, 'description')
  const amount = numberValue(formData, 'amount', 0)
  const expenseDate = text(formData, 'expense_date')

  if (!unitId || !categoryId || !description || !expenseDate || amount <= 0) {
    redirect('/financeiro?erro=Preencha+todos+os+campos+obrigatórios')
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (unitError || !unit) redirect('/financeiro?erro=Unidade+não+encontrada')

  let receiptPath: string | null = null
  try {
    receiptPath = await uploadPrivateFile(
      supabase,
      formData.get('receipt') instanceof File ? formData.get('receipt') as File : null,
      `expenses/${unit.client_id}/${unitId}`,
    )
  } catch (error) {
    redirect(`/financeiro?erro=${encodeURIComponent(error instanceof Error ? error.message : 'Falha no comprovante')}`)
  }

  const { data, error } = await supabase.from('expenses').insert({
    client_id: unit.client_id,
    unit_id: unitId,
    category_id: categoryId,
    description,
    amount,
    expense_date: expenseDate,
    supplier: optionalText(formData, 'supplier'),
    payment_method: optionalText(formData, 'payment_method'),
    payment_status: text(formData, 'payment_status') || 'paid',
    charge_owner: checkbox(formData, 'charge_owner'),
    receipt_path: receiptPath,
    notes: optionalText(formData, 'notes'),
  }).select('id').single()

  if (error) redirect(`/financeiro?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  redirect(`/financeiro/despesas/${data.id}?sucesso=Despesa+cadastrada`)
}

export async function updateExpenseAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const unitId = text(formData, 'unit_id')
  const amount = numberValue(formData, 'amount', 0)

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (!id || !unitId || !text(formData, 'category_id') || !text(formData, 'description') || amount <= 0 || unitError || !unit) {
    redirect(`/financeiro/despesas/${id}?erro=Dados+da+despesa+inválidos`)
  }

  const patch: Record<string, unknown> = {
    client_id: unit.client_id,
    unit_id: unitId,
    category_id: text(formData, 'category_id'),
    description: text(formData, 'description'),
    amount,
    expense_date: text(formData, 'expense_date'),
    supplier: optionalText(formData, 'supplier'),
    payment_method: optionalText(formData, 'payment_method'),
    payment_status: text(formData, 'payment_status') || 'paid',
    charge_owner: checkbox(formData, 'charge_owner'),
    notes: optionalText(formData, 'notes'),
  }

  try {
    const receipt = formData.get('receipt')
    const path = await uploadPrivateFile(
      supabase,
      receipt instanceof File ? receipt : null,
      `expenses/${unit.client_id}/${unitId}`,
    )
    if (path) patch.receipt_path = path
  } catch (error) {
    redirect(`/financeiro/despesas/${id}?erro=${encodeURIComponent(error instanceof Error ? error.message : 'Falha no comprovante')}`)
  }

  const { error } = await supabase.from('expenses').update(patch).eq('id', id)
  if (error) redirect(`/financeiro/despesas/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/financeiro')
  revalidatePath(`/financeiro/despesas/${id}`)
  revalidatePath('/dashboard')
  redirect(`/financeiro/despesas/${id}?sucesso=Despesa+atualizada`)
}

export async function cancelExpenseAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const id = text(formData, 'id')
  const reason = text(formData, 'cancellation_reason')

  if (!reason) redirect(`/financeiro/despesas/${id}?erro=Informe+o+motivo+do+cancelamento`)

  const { error } = await supabase.from('expenses').update({
    payment_status: 'cancelled',
    cancellation_reason: reason,
    cancelled_at: new Date().toISOString(),
    cancelled_by: user.id,
  }).eq('id', id)

  if (error) redirect(`/financeiro/despesas/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/financeiro')
  revalidatePath(`/financeiro/despesas/${id}`)
  revalidatePath('/dashboard')
  redirect(`/financeiro/despesas/${id}?sucesso=Despesa+cancelada`)
}

export async function markRevenueReceivedAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const receivedDate = text(formData, 'received_date')

  const { error } = await supabase.from('revenues').update({
    payment_status: 'paid',
    received_date: receivedDate || new Date().toISOString().slice(0, 10),
  }).eq('id', id)

  if (error) redirect(`/financeiro?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  redirect('/financeiro?sucesso=Receita+conciliada')
}

export async function createRecurringExpenseAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = text(formData, 'unit_id')

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (unitError || !unit || !text(formData, 'category_id') || !text(formData, 'description') || numberValue(formData, 'amount', 0) <= 0) {
    redirect('/financeiro/recorrencias?erro=Dados+da+recorrência+inválidos')
  }

  const startDate = text(formData, 'start_date')
  const { error } = await supabase.from('recurring_expenses').insert({
    client_id: unit.client_id,
    unit_id: unitId,
    category_id: text(formData, 'category_id'),
    description: text(formData, 'description'),
    supplier: optionalText(formData, 'supplier'),
    amount: numberValue(formData, 'amount', 0),
    frequency: text(formData, 'frequency') || 'monthly',
    start_date: startDate,
    next_due_date: text(formData, 'next_due_date') || startDate,
    end_date: optionalText(formData, 'end_date'),
    payment_method: optionalText(formData, 'payment_method'),
    charge_owner: checkbox(formData, 'charge_owner'),
  })

  if (error) redirect(`/financeiro/recorrencias?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/financeiro/recorrencias')
  redirect('/financeiro/recorrencias?sucesso=Recorrência+cadastrada')
}

export async function setRecurringExpenseActiveAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const active = text(formData, 'active') === 'true'
  const { error } = await supabase.from('recurring_expenses').update({ active }).eq('id', id)
  if (error) redirect(`/financeiro/recorrencias?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/financeiro/recorrencias')
  redirect(`/financeiro/recorrencias?sucesso=${active ? 'Recorrência+reativada' : 'Recorrência+pausada'}`)
}

export async function generateRecurringExpensesAction(formData: FormData) {
  const { supabase } = await requireUser()
  const throughDate = text(formData, 'through_date') || new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase.rpc('generate_due_recurring_expenses', {
    p_through_date: throughDate,
  })

  if (error) redirect(`/financeiro/recorrencias?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/recorrencias')
  redirect(`/financeiro/recorrencias?sucesso=${encodeURIComponent(`${data ?? 0} despesa(s) gerada(s)`)}`)
}

export async function createManualRevenueAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = text(formData, 'unit_id')
  const grossAmount = numberValue(formData, 'gross_amount', 0)
  const description = text(formData, 'description')
  const expectedDate = text(formData, 'expected_date')

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (!unitId || !description || !expectedDate || grossAmount <= 0 || unitError || !unit) {
    redirect('/financeiro?tipo=receitas&erro=Dados+da+receita+inválidos')
  }

  const { error } = await supabase.from('revenues').insert({
    client_id: unit.client_id,
    unit_id: unitId,
    source: 'manual',
    channel: text(formData, 'channel') || 'direct',
    description,
    gross_amount: grossAmount,
    platform_commission: numberValue(formData, 'platform_commission', 0),
    discounts: numberValue(formData, 'discounts', 0),
    expected_date: expectedDate,
    received_date: optionalText(formData, 'received_date'),
    payment_status: text(formData, 'payment_status') || 'pending',
    notes: optionalText(formData, 'notes'),
  })

  if (error) redirect(`/financeiro?tipo=receitas&erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  redirect('/financeiro?tipo=receitas&sucesso=Receita+cadastrada')
}
