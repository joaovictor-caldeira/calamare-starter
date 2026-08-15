import Link from 'next/link'
import { createClosingAction } from '@/actions/closings'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { currency, dateBR, todayISO } from '@/lib/format'

export const metadata = { title: 'Fechamentos' }

function defaultPeriod() {
  const today = new Date(`${todayISO()}T12:00:00`)
  const end = new Date(today.getFullYear(), today.getMonth(), 14, 12)
  if (today.getDate() < 15) end.setMonth(end.getMonth() - 1)
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 15, 12)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export default async function ClosingsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string; client?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const period = defaultPeriod()

  const [{ data: clients }, closingsResult] = await Promise.all([
    supabase.from('clients').select('id, name, closing_day, payout_day').eq('status', 'active').order('name'),
    (() => {
      let query = supabase.from('closings').select('*, clients(name), payouts(id, status, scheduled_date, paid_at)').order('period_end', { ascending: false }).limit(100)
      if (params.client) query = query.eq('client_id', params.client)
      return query
    })(),
  ])
  const closings = closingsResult.data

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">PRESTAÇÃO DE CONTAS</p><h1>Fechamentos e repasses</h1><p className="muted">O fechamento guarda uma fotografia dos lançamentos e fica bloqueado após aprovação.</p></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />

      <section className="panel"><div className="panelHeader"><h2>Novo fechamento</h2></div>
        <form action={createClosingAction} className="formGrid">
          <label>Cliente*<select name="client_id" required><option value="">Selecione</option>{clients?.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label>Início do ciclo<input type="date" name="period_start" defaultValue={period.start} required /></label>
          <label>Fim do ciclo<input type="date" name="period_end" defaultValue={period.end} required /></label>
          <label>Reserva de emergência<input type="number" min="0" step="0.01" name="emergency_reserve" placeholder="Vazio usa o padrão do cliente" /></label>
          <div className="formActions"><button className="button primary">Calcular fechamento</button></div>
        </form>
        <p className="muted topGap">Antes de calcular, concilie as receitas realmente recebidas e confira as despesas. Receitas pendentes ou atrasadas não entram no repasse. Um fechamento em aberto para o mesmo ciclo será recalculado; um aprovado nunca será sobrescrito.</p>
      </section>

      <section className="panel"><div className="panelHeader"><h2>Fechamentos</h2><span className="badge neutral">{closings?.length ?? 0}</span></div>
        <form className="filters" method="get"><label>Cliente<select name="client" defaultValue={params.client ?? ''}><option value="">Todos</option>{clients?.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><button className="button secondary">Filtrar</button><Link className="button linkButton" href="/fechamentos">Limpar</Link></form>
        <div className="tableWrap"><table><thead><tr><th>Cliente</th><th>Período</th><th>Receita</th><th>Despesas</th><th>Comissão JOCA</th><th>Líquido proprietário</th><th>Status</th><th></th></tr></thead><tbody>
          {closings?.map((closing: any) => <tr key={closing.id}><td>{closing.clients?.name}</td><td>{dateBR(closing.period_start)} → {dateBR(closing.period_end)}</td><td>{currency(closing.gross_revenue)}</td><td>{currency(closing.operating_expenses)}</td><td>{currency(closing.management_fee)}</td><td><strong>{currency(closing.owner_net)}</strong></td><td><span className={`badge ${closing.status === 'approved' || closing.status === 'paid' ? 'confirmed' : 'pending'}`}>{closing.status}</span></td><td><Link className="tableLink" href={`/fechamentos/${closing.id}`}>Abrir</Link></td></tr>)}
          {!closings?.length && <tr><td colSpan={8} className="empty">Nenhum fechamento calculado.</td></tr>}
        </tbody></table></div>
      </section>
    </>
  )
}
