'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { numberValue, optionalText, text } from '@/lib/form'
import { uploadPrivateFile } from '@/lib/storage'

export async function createCleaningChecklistItemAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = text(formData, 'unit_id')
  const label = text(formData, 'label')

  if (!unitId || !label) redirect(`/unidades/${unitId}?erro=Informe+o+item+do+checklist`)

  const { error } = await supabase.from('cleaning_checklist_items').insert({
    unit_id: unitId,
    label,
    sort_order: numberValue(formData, 'sort_order', 0),
  })

  if (error) redirect(`/unidades/${unitId}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath(`/unidades/${unitId}`)
  redirect(`/unidades/${unitId}?sucesso=Item+de+checklist+adicionado`)
}

export async function createDefaultCleaningChecklistAction(formData: FormData) {
  const { supabase } = await requireUser()
  const unitId = text(formData, 'unit_id')
  const labels = [
    'Retirar lixo e objetos deixados',
    'Trocar roupas de cama e banho',
    'Higienizar banheiros',
    'Limpar cozinha e eletrodomésticos',
    'Limpar pisos e superfícies',
    'Conferir amenidades e reposições',
    'Testar iluminação, ar-condicionado e Wi-Fi',
    'Fotografar ambientes após a limpeza',
  ]

  const { data: existing } = await supabase
    .from('cleaning_checklist_items')
    .select('label')
    .eq('unit_id', unitId)
    .eq('active', true)

  const existingLabels = new Set(
    (existing ?? []).map((item: { label: string }) => item.label.trim().toLowerCase()),
  )
  const missing = labels
    .map((label, index) => ({ label, sort_order: index + 1 }))
    .filter((item) => !existingLabels.has(item.label.toLowerCase()))
    .map((item) => ({ unit_id: unitId, ...item }))

  if (missing.length) {
    const { error } = await supabase.from('cleaning_checklist_items').insert(missing)
    if (error) redirect(`/unidades/${unitId}?erro=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/unidades/${unitId}`)
  redirect(`/unidades/${unitId}?sucesso=Checklist+padrão+conferido`)
}

export async function updateCleaningTaskAction(formData: FormData) {
  const { supabase } = await requireUser()
  const id = text(formData, 'id')
  const status = text(formData, 'status') || 'waiting'

  if (status === 'completed') {
    const { count, error: checklistError } = await supabase
      .from('cleaning_task_items')
      .select('id', { count: 'exact', head: true })
      .eq('cleaning_task_id', id)
      .eq('is_done', false)

    if (checklistError) redirect(`/limpezas/${id}?erro=${encodeURIComponent(checklistError.message)}`)
    if ((count ?? 0) > 0) {
      redirect(`/limpezas/${id}?erro=Conclua+todos+os+itens+do+checklist+antes+de+finalizar`)
    }
  }

  const { error } = await supabase.from('cleaning_tasks').update({
    assigned_to: optionalText(formData, 'assigned_to'),
    status,
    priority: text(formData, 'priority') || 'normal',
    notes: optionalText(formData, 'notes'),
    found_items: optionalText(formData, 'found_items'),
    damages: optionalText(formData, 'damages'),
    materials_to_replace: optionalText(formData, 'materials_to_replace'),
    cleaning_cost: numberValue(formData, 'cleaning_cost', 0),
    laundry_cost: numberValue(formData, 'laundry_cost', 0),
    completed_at: status === 'completed' ? new Date().toISOString() : null,
  }).eq('id', id)

  if (error) redirect(`/limpezas/${id}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath('/limpezas')
  revalidatePath(`/limpezas/${id}`)
  redirect(`/limpezas/${id}?sucesso=Tarefa+atualizada`)
}

export async function toggleCleaningTaskItemAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const id = text(formData, 'id')
  const taskId = text(formData, 'task_id')
  const isDone = text(formData, 'is_done') === 'true'

  const { error } = await supabase.from('cleaning_task_items').update({
    is_done: isDone,
    completed_at: isDone ? new Date().toISOString() : null,
    completed_by: isDone ? user.id : null,
  }).eq('id', id)

  if (error) redirect(`/limpezas/${taskId}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath(`/limpezas/${taskId}`)
  redirect(`/limpezas/${taskId}`)
}

export async function uploadCleaningPhotoAction(formData: FormData) {
  const { supabase } = await requireUser()
  const taskId = text(formData, 'task_id')
  const kind = text(formData, 'kind') === 'before' ? 'before' : 'after'
  const entry = formData.get('photo')
  const file = entry instanceof File ? entry : null

  if (!file || file.size === 0) {
    redirect(`/limpezas/${taskId}?erro=Selecione+uma+foto`)
  }

  const { data: task, error: taskError } = await supabase
    .from('cleaning_tasks')
    .select('client_id, unit_id, before_photos, after_photos')
    .eq('id', taskId)
    .single()

  if (taskError || !task) redirect(`/limpezas/${taskId}?erro=Tarefa+não+encontrada`)

  let path = ''
  try {
    path = await uploadPrivateFile(
      supabase,
      file,
      `cleaning/${task.client_id}/${task.unit_id}/${taskId}/${kind}`,
    ) as string
  } catch (error) {
    redirect(`/limpezas/${taskId}?erro=${encodeURIComponent(error instanceof Error ? error.message : 'Falha no upload')}`)
  }

  if (!path) redirect(`/limpezas/${taskId}?erro=O+upload+não+retornou+um+caminho`)

  const field = kind === 'before' ? 'before_photos' : 'after_photos'
  const current = kind === 'before' ? task.before_photos : task.after_photos
  const { error } = await supabase.from('cleaning_tasks').update({
    [field]: [...(current ?? []), path],
  }).eq('id', taskId)

  if (error) redirect(`/limpezas/${taskId}?erro=${encodeURIComponent(error.message)}`)
  revalidatePath(`/limpezas/${taskId}`)
  redirect(`/limpezas/${taskId}?sucesso=Foto+enviada`)
}
