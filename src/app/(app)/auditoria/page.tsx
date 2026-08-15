import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { requireUser } from '@/lib/auth'
import { dateTimeBR } from '@/lib/format'
import { pageRange, positiveInteger, totalPages } from '@/lib/pagination'

export const metadata = { title: 'Auditoria' }

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string; action?: string; from?: string; to?: string; page?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const page = positiveInteger(params.page)
  const { from, to } = pageRange(page)
  let query = supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
  if (params.table) query = query.eq('table_name', params.table)
  if (params.action) query = query.eq('action', params.action)
  if (params.from) query = query.gte('created_at', `${params.from}T00:00:00`)
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59`)
  const { data: logs, count, error } = await query

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">SEGURANÇA</p><h1>Auditoria</h1><p className="muted">Registro das inclusões, alterações e exclusões permitidas.</p></div></header>
      {error && <div className="alert error">{error.message}. Esta página é restrita ao superadministrador.</div>}
      <section className="panel"><form className="filters" method="get"><label>Módulo<select name="table" defaultValue={params.table ?? ''}><option value="">Todos</option><option value="clients">Clientes</option><option value="properties">Imóveis</option><option value="units">Unidades</option><option value="reservations">Reservas</option><option value="expenses">Despesas</option><option value="revenues">Receitas</option><option value="closings">Fechamentos</option><option value="cleaning_tasks">Limpezas</option><option value="maintenance_tickets">Manutenções</option><option value="inventory_items">Inventário</option></select></label><label>Ação<select name="action" defaultValue={params.action ?? ''}><option value="">Todas</option><option value="insert">Criação</option><option value="update">Alteração</option><option value="delete">Exclusão</option></select></label><label>De<input type="date" name="from" defaultValue={params.from} /></label><label>Até<input type="date" name="to" defaultValue={params.to} /></label><button className="button secondary">Filtrar</button><Link className="button linkButton" href="/auditoria">Limpar</Link></form></section>
      <section className="panel"><div className="panelHeader"><h2>Registros</h2><span className="badge neutral">{count ?? 0}</span></div><div className="tableWrap"><table><thead><tr><th>Data e hora</th><th>Módulo</th><th>Ação</th><th>Registro</th><th>Usuário</th><th>Campos alterados</th></tr></thead><tbody>{logs?.map((log: any) => { const oldData = log.old_data ?? {}; const newData = log.new_data ?? {}; const fields = [...new Set([...Object.keys(oldData), ...Object.keys(newData)])].filter((key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])).filter((key) => !['updated_at','updated_by'].includes(key)); return <tr key={log.id}><td>{dateTimeBR(log.created_at)}</td><td>{log.table_name}</td><td><span className="badge neutral">{log.action}</span></td><td>{log.record_id ?? '—'}</td><td>{log.user_id ?? 'automação'}</td><td>{fields.join(', ') || '—'}</td></tr>})}{!logs?.length && <tr><td colSpan={6} className="empty">Nenhum registro encontrado.</td></tr>}</tbody></table></div><Pagination basePath="/auditoria" page={page} totalPages={totalPages(count ?? 0)} searchParams={params} /></section>
    </>
  )
}
