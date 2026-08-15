import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { requireUser } from '@/lib/auth'
import { currency, dateBR } from '@/lib/format'
import { pageRange, positiveInteger, totalPages } from '@/lib/pagination'

export const metadata = { title: 'Limpezas' }

export default async function CleaningsPage({ searchParams }: { searchParams: Promise<{ unit?: string; status?: string; from?: string; to?: string; page?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const page = positiveInteger(params.page)
  const { from, to } = pageRange(page)
  const { data: units } = await supabase.from('units').select('id, name').order('name')

  let query = supabase.from('cleaning_tasks').select('*, units(name), reservations(guest_name), profiles(full_name)', { count: 'exact' }).order('scheduled_date', { ascending: false }).range(from, to)
  if (params.unit) query = query.eq('unit_id', params.unit)
  if (params.status && params.status !== 'all') query = query.eq('status', params.status)
  if (params.from) query = query.gte('scheduled_date', params.from)
  if (params.to) query = query.lte('scheduled_date', params.to)
  const { data: tasks, count } = await query

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">OPERAÇÃO</p><h1>Limpezas</h1><p className="muted">As reservas confirmadas criam automaticamente uma tarefa para o check-out.</p></div></header>
      <section className="panel"><form className="filters" method="get"><label>Unidade<select name="unit" defaultValue={params.unit ?? ''}><option value="">Todas</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name}</option>)}</select></label><label>Status<select name="status" defaultValue={params.status ?? 'all'}><option value="all">Todos</option><option value="waiting">Aguardando</option><option value="confirmed">Confirmada</option><option value="in_progress">Em execução</option><option value="completed">Concluída</option><option value="pending_issue">Com pendência</option><option value="cancelled">Cancelada</option></select></label><label>De<input type="date" name="from" defaultValue={params.from} /></label><label>Até<input type="date" name="to" defaultValue={params.to} /></label><button className="button secondary">Filtrar</button><Link className="button linkButton" href="/limpezas">Limpar</Link></form></section>
      <section className="panel"><div className="panelHeader"><h2>Tarefas de limpeza</h2><span className="badge neutral">{count ?? 0}</span></div><div className="tableWrap"><table><thead><tr><th>Data</th><th>Unidade</th><th>Reserva</th><th>Responsável</th><th>Status</th><th>Custos</th><th></th></tr></thead><tbody>{tasks?.map((task: any) => <tr key={task.id}><td>{dateBR(task.scheduled_date)}</td><td>{task.units?.name}</td><td>{task.reservations?.guest_name ?? '—'}</td><td>{task.profiles?.full_name ?? 'Não atribuído'}</td><td><span className={`badge ${task.status}`}>{task.status}</span></td><td>{currency(Number(task.cleaning_cost) + Number(task.laundry_cost))}</td><td><Link className="tableLink" href={`/limpezas/${task.id}`}>Abrir</Link></td></tr>)}{!tasks?.length && <tr><td colSpan={7} className="empty">Nenhuma tarefa encontrada.</td></tr>}</tbody></table></div><Pagination basePath="/limpezas" page={page} totalPages={totalPages(count ?? 0)} searchParams={params} /></section>
    </>
  )
}
