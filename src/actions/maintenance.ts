'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { checkbox, numberValue, optionalText, text } from '@/lib/form'
import { uploadPrivateFile } from '@/lib/storage'

export async function createMaintenanceTicketAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = text(formData, 'unit_id')
  const title = text(formData, 'title')

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unitId)
    .single()

  if (!unitId || !title || unitError || !unit) {
    redirect('/manutencoes?erro=Selecione+a+unidade+e+informe+o+problema')
  }

  const blocksUnit = checkbox(formData, 'blocks_unit')
  const blockStart = optionalText(formData, 'block_start')
  const blockEnd = optionalText(formData, 'block_end')
  if (blocksUnit && (!blockStart || !blockEnd || blockEnd <= blockStart)) {
    redirect('/manutencoes?erro=Informe+um+período+de+bloqueio+válido')
  }

  const { data, error } = await supabase.from('maintenance_tickets').insert({
    client_id: unit.client_id,
    unit_id: unitId,
    title,
    category: optionalText(formData, 'category'),
    urgency: text(formData, 'urgency') || 'normal',
    description: optionalText(formData, 'description'),
    assigned_to: optionalText(formData, 'assigned_to'),
    supplier: optionalText(formData, 'supplier'),
    estimated_cost: numberValue(formData, 'estimated_cost', 0) || null,
    due_date: optionalText(formData, 'due_date'),
    status: 'identified',
    blocks_unit: blocksUnit,
    block_start: blockStart,
    block_end: blockEnd,
  }).select('id').single()

  if (error) redirect(`/manutencoes?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/manutencoes')
  revalidatePath('/calendario')
  redirect(`/manutencoes/${data.id}?sucesso=Chamado+aberto`)
}

export async function updateMaintenanceTicketAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const requestedStatus = text(formData, 'status') || 'identified'
  if (requestedStatus === 'concluded') {
    redirect(`/manutencoes/${id}?erro=Use+a+seção+Concluir+manutenção+para+gerar+a+despesa`)
  }
  const blocksUnit = checkbox(formData, 'blocks_unit')
  const blockStart = optionalText(formData, 'block_start')
  const blockEnd = optionalText(formData, 'block_end')

  if (blocksUnit && (!blockStart || !blockEnd || blockEnd <= blockStart)) {
    redirect(`/manutencoes/${id}?erro=Informe+um+período+de+bloqueio+válido`)
  }

  const { error } = await supabase.from('maintenance_tickets').update({
    title: text(formData, 'title'),
    category: optionalText(formData, 'category'),
    urgency: text(formData, 'urgency') || 'normal',
    description: optionalText(formData, 'description'),
    assigned_to: optionalText(formData, 'assigned_to'),
    supplier: optionalText(formData, 'supplier'),
    estimated_cost: numberValue(formData, 'estimated_cost', 0) || null,
    approved_cost: numberValue(formData, 'approved_cost', 0) || null,
    due_date: optionalText(formData, 'due_date'),
    status: requestedStatus,
    blocks_unit: blocksUnit,
    block_start: blockStart,
    block_end: blockEnd,
  }).eq('id', id)

  if (error) redirect(`/manutencoes/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/manutencoes')
  revalidatePath(`/manutencoes/${id}`)
  revalidatePath('/calendario')
  redirect(`/manutencoes/${id}?sucesso=Chamado+atualizado`)
}

export async function approveMaintenanceTicketAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const id = text(formData, 'id')
  const approvedCost = numberValue(formData, 'approved_cost', 0)

  const { error } = await supabase.from('maintenance_tickets').update({
    status: 'approved',
    approved_cost: approvedCost,
    approved_at: new Date().toISOString(),
    approved_by: user.id,
  }).eq('id', id)

  if (error) redirect(`/manutencoes/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/manutencoes')
  revalidatePath(`/manutencoes/${id}`)
  redirect(`/manutencoes/${id}?sucesso=Orçamento+aprovado`)
}

export async function completeMaintenanceTicketAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const categoryId = text(formData, 'category_id')
  const finalCost = numberValue(formData, 'final_cost', 0)

  if (!categoryId) redirect(`/manutencoes/${id}?erro=Selecione+a+categoria+financeira`)

  const { error } = await supabase.rpc('complete_maintenance_ticket', {
    p_ticket_id: id,
    p_category_id: categoryId,
    p_final_cost: finalCost,
    p_completion_notes: optionalText(formData, 'completion_notes'),
  })

  if (error) redirect(`/manutencoes/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/manutencoes')
  revalidatePath(`/manutencoes/${id}`)
  revalidatePath('/financeiro')
  revalidatePath('/calendario')
  redirect(`/manutencoes/${id}?sucesso=Manutenção+concluída+e+despesa+gerada`)
}

export async function uploadMaintenanceFileAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const kind = text(formData, 'kind') === 'quote' ? 'quote' : 'photo'
  const entry = formData.get('file')
  const file = entry instanceof File ? entry : null

  if (!file || file.size === 0) {
    redirect(`/manutencoes/${id}?erro=Selecione+um+arquivo`)
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('maintenance_tickets')
    .select('client_id, unit_id, photo_paths')
    .eq('id', id)
    .single()

  if (ticketError || !ticket) redirect(`/manutencoes/${id}?erro=Chamado+não+encontrado`)

  let path = ''
  try {
    path = await uploadPrivateFile(
      supabase,
      file,
      `maintenance/${ticket.client_id}/${ticket.unit_id}/${id}/${kind}`,
    ) as string
  } catch (error) {
    redirect(`/manutencoes/${id}?erro=${encodeURIComponent(error instanceof Error ? error.message : 'Falha no upload')}`)
  }

  if (!path) redirect(`/manutencoes/${id}?erro=O+upload+não+retornou+um+caminho`)

  const patch = kind === 'quote'
    ? { quote_path: path }
    : { photo_paths: [...(ticket.photo_paths ?? []), path] }

  const { error } = await supabase.from('maintenance_tickets').update(patch).eq('id', id)
  if (error) redirect(`/manutencoes/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath(`/manutencoes/${id}`)
  redirect(`/manutencoes/${id}?sucesso=Arquivo+enviado`)
}
