import Link from 'next/link'
import { notFound } from 'next/navigation'
import { toggleCleaningTaskItemAction, updateCleaningTaskAction, uploadCleaningPhotoAction } from '@/actions/cleaning'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { dateBR } from '@/lib/format'
import { signedFileUrl } from '@/lib/storage'

export default async function CleaningDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { id } = await params
  const messages = await searchParams
  const { supabase } = await requireUser()
  const [{ data: task }, { data: items }, { data: cleaners }] = await Promise.all([
    supabase.from('cleaning_tasks').select('*, units(name), reservations(guest_name, check_in, check_out)').eq('id', id).single(),
    supabase.from('cleaning_task_items').select('*').eq('cleaning_task_id', id).order('sort_order'),
    supabase.from('profiles').select('id, full_name, role').eq('is_active', true).in('role', ['limpeza','admin_operacional','superadmin']).order('full_name'),
  ])
  if (!task) notFound()

  const beforeUrls = (await Promise.all((task.before_photos ?? []).map((path: string) => signedFileUrl(supabase, path)))).filter(Boolean) as string[]
  const afterUrls = (await Promise.all((task.after_photos ?? []).map((path: string) => signedFileUrl(supabase, path)))).filter(Boolean) as string[]
  const completed = (items ?? []).filter((item: any) => item.is_done).length

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">LIMPEZA</p><h1>{task.units?.name}</h1><p className="muted">Agendada para {dateBR(task.scheduled_date)} — saída de {task.reservations?.guest_name ?? 'reserva'}</p></div><Link className="button secondary" href="/limpezas">Voltar</Link></header>
      <Feedback erro={messages.erro} sucesso={messages.sucesso} />
      <section className="panel"><div className="panelHeader"><h2>Gestão da tarefa</h2><span className={`badge ${task.status}`}>{task.status}</span></div><form action={updateCleaningTaskAction} className="formGrid"><input type="hidden" name="id" value={task.id} /><label>Responsável<select name="assigned_to" defaultValue={task.assigned_to ?? ''}><option value="">Não atribuído</option>{cleaners?.map((p: any) => <option value={p.id} key={p.id}>{p.full_name} — {p.role}</option>)}</select></label><label>Status<select name="status" defaultValue={task.status}><option value="waiting">Aguardando</option><option value="confirmed">Confirmada</option><option value="in_progress">Em execução</option><option value="completed">Concluída</option><option value="pending_issue">Com pendência</option><option value="cancelled">Cancelada</option></select></label><label>Prioridade<select name="priority" defaultValue={task.priority}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label><label>Custo da limpeza<input type="number" step="0.01" min="0" name="cleaning_cost" defaultValue={task.cleaning_cost} /></label><label>Custo da lavanderia<input type="number" step="0.01" min="0" name="laundry_cost" defaultValue={task.laundry_cost} /></label><label className="span2">Observações<textarea name="notes" rows={3} defaultValue={task.notes ?? ''} /></label><label className="span2">Objetos encontrados<textarea name="found_items" rows={2} defaultValue={task.found_items ?? ''} /></label><label className="span2">Avarias<textarea name="damages" rows={2} defaultValue={task.damages ?? ''} /></label><label className="span2">Materiais para reposição<textarea name="materials_to_replace" rows={2} defaultValue={task.materials_to_replace ?? ''} /></label><div className="formActions"><button className="button primary">Salvar tarefa</button></div></form></section>
      <section className="panel"><div className="panelHeader"><div><h2>Checklist</h2><p className="muted">{completed} de {items?.length ?? 0} concluídos</p></div></div><div className="checkList">{items?.map((item: any) => <form action={toggleCleaningTaskItemAction} className={`checkItem ${item.is_done ? 'done' : ''}`} key={item.id}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="task_id" value={task.id} /><input type="hidden" name="is_done" value={String(!item.is_done)} /><button className="checkToggle" aria-label={item.is_done ? 'Desmarcar' : 'Concluir'}>{item.is_done ? '✓' : '○'}</button><strong>{item.label_snapshot}</strong></form>)}{!items?.length && <p className="empty">Esta tarefa foi criada antes do checklist da unidade. Crie o checklist na página da unidade para as próximas tarefas.</p>}</div></section>
      <section className="twoColumns"><div className="panel"><div className="panelHeader"><h2>Fotos antes</h2></div><div className="photoGrid">{beforeUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt="Antes da limpeza" /></a>)}</div><form action={uploadCleaningPhotoAction} className="inlineForm topGap" encType="multipart/form-data"><input type="hidden" name="task_id" value={task.id} /><input type="hidden" name="kind" value="before" /><input type="file" name="photo" accept="image/*" required /><button className="button secondary">Enviar</button></form></div><div className="panel"><div className="panelHeader"><h2>Fotos depois</h2></div><div className="photoGrid">{afterUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt="Depois da limpeza" /></a>)}</div><form action={uploadCleaningPhotoAction} className="inlineForm topGap" encType="multipart/form-data"><input type="hidden" name="task_id" value={task.id} /><input type="hidden" name="kind" value="after" /><input type="file" name="photo" accept="image/*" required /><button className="button secondary">Enviar</button></form></div></section>
    </>
  )
}
