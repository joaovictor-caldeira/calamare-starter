'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'

export async function createExpenseAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = String(formData.get('unit_id') ?? '')
  const categoryId = String(formData.get('category_id') ?? '')
  const description = String(formData.get('description') ?? '').trim()
  const amount = Number(formData.get('amount') ?? 0)
  const expenseDate = String(formData.get('expense_date') ?? '')
  const supplier = String(formData.get('supplier') ?? '').trim() || null
  const chargeOwner = formData.get('charge_owner') === 'on'

  if (!unitId || !categoryId || !description || !expenseDate || amount <= 0) {
    redirect('/financeiro?erro=Preencha+todos+os+campos+obrigatórios')
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (unitError || !unit) redirect('/financeiro?erro=Unidade+não+encontrada')

  const { error } = await supabase.from('expenses').insert({
    client_id: unit.client_id,
    unit_id: unitId,
    category_id: categoryId,
    description,
    amount,
    expense_date: expenseDate,
    supplier,
    charge_owner: chargeOwner,
    payment_status: 'paid',
  })

  if (error) redirect(`/financeiro?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  redirect('/financeiro?sucesso=Despesa+cadastrada')
}
