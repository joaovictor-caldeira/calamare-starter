'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'

export async function createClientAction(formData: FormData) {
  const { supabase } = await requireUser()
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const cpfCnpj = String(formData.get('cpf_cnpj') ?? '').trim() || null
  const managementFee = Number(formData.get('management_fee') ?? 0)
  const closingDay = Number(formData.get('closing_day') ?? 15)
  const payoutDay = Number(formData.get('payout_day') ?? 20)

  if (!name) redirect('/clientes?erro=O+nome+do+cliente+é+obrigatório')

  const { error } = await supabase.from('clients').insert({
    name,
    email,
    phone,
    cpf_cnpj: cpfCnpj,
    management_fee_value: Number.isFinite(managementFee) ? managementFee : 0,
    closing_day: closingDay,
    payout_day: payoutDay,
  })

  if (error) redirect(`/clientes?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/clientes')
  redirect('/clientes?sucesso=Cliente+cadastrado')
}
