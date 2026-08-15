import Link from 'next/link'
import { createMaintenanceTicketAction } from '@/actions/maintenance'
import { Feedback } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { requireUser } from '@/lib/auth'
import { currency, dateBR } from '@/lib/format'
import { pageRange, positiveInteger, totalPages } from '@/lib/pagination'

export const metadata = { title: 'Manutenções' }

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string; unit?: string; status?: string; urgency?: string; page?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const page = positiveInteger(params.page)
  const { from, to } = pageRange(page)
  const [{ data: units }, { data: providers }] = await Promise.all([
    supabase.from('units').select('id, name, properties(name)').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, role').eq('is_active', true).in('role', ['manutencao','admin_operacional','superadmin']).order('full_name'),
  ])
  let query = supabase.from('maintenance_tickets').select('*, units(name), profiles(full_name)', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
  if (params.unit) query = query.eq('unit_id', params.unit)
  if (params.status && params.status !== 'all') query = query.eq('status', params.status)
  if (params.urgency && params.urgency !== 'all') query = query.eq('urgency', params.urgency)
  const { data: tickets, count } = await query

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">OPERAÇÃO</p><h1>Manutenções</h1><p className="muted">Controle problemas, orçamentos, aprovações, bloqueios e custos.</p></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />
      <section className="panel"><div className="panelHeader"><h2>Abrir chamado</h2></div><form action={createMaintenanceTicketAction} className="formGrid"><label>Unidade*<select name="unit_id" required><option value="">Selecione</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label><label>Problema*<input name="title" required /></label><label>Categoria<input name="category" placeholder="Elétrica, hidráulica..." /></label><label>Urgência<select name="urgency" defaultValue="normal"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><label>Responsável<select name="assigned_to"><option value="">Não atribuído</option>{providers?.map((p: any) => <option value={p.id} key={p.id}>{p.full_name}</option>)}</select></label><label>Fornecedor<input name="supplier" /></label><label>Custo estimado<input type="number" min="0" step="0.01" name="estimated_cost" /></label><label>Prazo<input type="date" name="due_date" /></label><label className="span2">Descrição<textarea name="description" rows={3} /></label><label className="checkbox"><input type="checkbox" name="blocks_unit" /> Bloquear hospedagens</label><label>Início do bloqueio<input type="date" name="block_start" /></label><label>Fim do bloqueio<input type="date" name="block_end" /></label><div className="formActions"><button className="button primary">Abrir chamado</button></div></form></section>
      <section className="panel"><form className="filters" method="get"><label>Unidade<select name="unit" defaultValue={params.unit ?? ''}><option value="">Todas</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name}</option>)}</select></label><label>Status<select name="status" defaultValue={params.status ?? 'all'}><option value="all">Todos</option><option value="identified">Identificada</option><option value="awaiting_quote">Aguardando orçamento</option><option value="awaiting_approval">Aguardando aprovação</option><option value="approved">Aprovada</option><option value="in_progress">Em execução</option><option value="concluded">Concluída</option><option value="cancelled">Cancelada</option></select></label><label>Urgência<select name="urgency" defaultValue={params.urgency ?? 'all'}><option value="all">Todas</option><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><button className="button secondary">Filtrar</button><Link className="button linkButton" href="/manutencoes">Limpar</Link></form></section>
      <section className="panel"><div className="panelHeader"><h2>Chamados</h2><span className="badge neutral">{count ?? 0}</span></div><div className="tableWrap"><table><thead><tr><th>Abertura</th><th>Unidade</th><th>Problema</th><th>Urgência</th><th>Responsável</th><th>Status</th><th>Custo</th><th></th></tr></thead><tbody>{tickets?.map((ticket: any) => <tr key={ticket.id}><td>{dateBR(ticket.created_at)}</td><td>{ticket.units?.name}</td><td>{ticket.title}</td><td><span className={`badge ${ticket.urgency === 'critical' ? 'cancelled' : 'neutral'}`}>{ticket.urgency}</span></td><td>{ticket.profiles?.full_name ?? '—'}</td><td><span className={`badge ${ticket.status === 'concluded' ? 'confirmed' : 'pending'}`}>{ticket.status}</span></td><td>{currency(ticket.final_cost ?? ticket.approved_cost ?? ticket.estimated_cost ?? 0)}</td><td><Link className="tableLink" href={`/manutencoes/${ticket.id}`}>Abrir</Link></td></tr>)}{!tickets?.length && <tr><td colSpan={8} className="empty">Nenhum chamado encontrado.</td></tr>}</tbody></table></div><Pagination basePath="/manutencoes" page={page} totalPages={totalPages(count ?? 0)} searchParams={params} /></section>
    </>
  )
}
