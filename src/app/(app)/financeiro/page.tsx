import Link from 'next/link'
import {
  createExpenseAction,
  createManualRevenueAction,
  markRevenueReceivedAction,
} from '@/actions/expenses'
import { Feedback } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { requireUser } from '@/lib/auth'
import { currency, dateBR, todayISO } from '@/lib/format'
import { pageRange, positiveInteger, totalPages } from '@/lib/pagination'

export const metadata = { title: 'Financeiro' }

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string
    sucesso?: string
    tipo?: string
    unit?: string
    status?: string
    from?: string
    to?: string
    page?: string
  }>
}) {
  const params = await searchParams
  const type = params.tipo === 'receitas' ? 'receitas' : 'despesas'
  const { supabase } = await requireUser()
  const page = positiveInteger(params.page)
  const { from, to } = pageRange(page)

  const [{ data: units }, { data: categories }] = await Promise.all([
    supabase.from('units').select('id, name, properties(name)').eq('status', 'active').order('name'),
    supabase.from('financial_categories').select('id, name').eq('type', 'expense').eq('active', true).order('name'),
  ])

  let rows: any[] | null = []
  let count = 0
  if (type === 'receitas') {
    let query = supabase
      .from('revenues')
      .select('*, units(name), reservations(guest_name)', { count: 'exact' })
      .order('expected_date', { ascending: false })
      .range(from, to)
    if (params.unit) query = query.eq('unit_id', params.unit)
    if (params.status && params.status !== 'all') query = query.eq('payment_status', params.status)
    if (params.from) query = query.gte('expected_date', params.from)
    if (params.to) query = query.lte('expected_date', params.to)
    const result = await query
    rows = result.data
    count = result.count ?? 0
  } else {
    let query = supabase
      .from('expenses')
      .select('*, units(name), financial_categories(name)', { count: 'exact' })
      .order('expense_date', { ascending: false })
      .range(from, to)
    if (params.unit) query = query.eq('unit_id', params.unit)
    if (params.status && params.status !== 'all') query = query.eq('payment_status', params.status)
    if (params.from) query = query.gte('expense_date', params.from)
    if (params.to) query = query.lte('expense_date', params.to)
    const result = await query
    rows = result.data
    count = result.count ?? 0
  }

  const totalListed = (rows ?? []).reduce((sum: number, row: any) => {
    return sum + Number(type === 'receitas' ? row.net_amount : row.amount)
  }, 0)

  return (
    <>
      <header className="pageHeader">
        <div><p className="eyebrow">CONTROLE</p><h1>Financeiro</h1><p className="muted">Receitas, conciliação, despesas e recorrências.</p></div>
        <div className="headerValue"><small>Total da página</small><strong>{currency(totalListed)}</strong></div>
      </header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />

      <nav className="tabBar">
        <Link className={type === 'despesas' ? 'active' : ''} href="/financeiro?tipo=despesas">Despesas</Link>
        <Link className={type === 'receitas' ? 'active' : ''} href="/financeiro?tipo=receitas">Receitas</Link>
        <Link href="/financeiro/recorrencias">Recorrências</Link>
        <Link href="/fechamentos">Fechamentos</Link>
      </nav>

      {type === 'despesas' ? (
        <section className="panel"><div className="panelHeader"><h2>Nova despesa</h2></div>
          <form action={createExpenseAction} className="formGrid" encType="multipart/form-data">
            <label>Unidade*<select name="unit_id" required><option value="">Selecione</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label>
            <label>Categoria*<select name="category_id" required><option value="">Selecione</option>{categories?.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            <label>Descrição*<input name="description" required /></label>
            <label>Fornecedor<input name="supplier" /></label>
            <label>Valor*<input type="number" step="0.01" min="0.01" name="amount" required /></label>
            <label>Data*<input type="date" name="expense_date" defaultValue={todayISO()} required /></label>
            <label>Forma de pagamento<input name="payment_method" /></label>
            <label>Status<select name="payment_status" defaultValue="paid"><option value="pending">Pendente</option><option value="paid">Pago</option><option value="overdue">Atrasado</option></select></label>
            <label>Comprovante<input type="file" name="receipt" accept="image/*,.pdf" /></label>
            <label className="checkbox"><input type="checkbox" name="charge_owner" defaultChecked /> Descontar do proprietário</label>
            <label className="span2">Observações<textarea name="notes" rows={3} /></label>
            <div className="formActions"><button className="button primary">Salvar despesa</button></div>
          </form>
        </section>
      ) : (
        <section className="panel"><div className="panelHeader"><h2>Nova receita manual</h2></div>
          <form action={createManualRevenueAction} className="formGrid">
            <label>Unidade*<select name="unit_id" required><option value="">Selecione</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label>
            <label>Descrição*<input name="description" required /></label>
            <label>Canal<select name="channel" defaultValue="direct"><option value="direct">Direta</option><option value="airbnb">Airbnb</option><option value="booking">Booking</option></select></label>
            <label>Valor bruto*<input type="number" step="0.01" min="0.01" name="gross_amount" required /></label>
            <label>Comissão do canal<input type="number" step="0.01" min="0" name="platform_commission" defaultValue="0" /></label>
            <label>Descontos<input type="number" step="0.01" min="0" name="discounts" defaultValue="0" /></label>
            <label>Data prevista*<input type="date" name="expected_date" defaultValue={todayISO()} required /></label>
            <label>Data recebida<input type="date" name="received_date" /></label>
            <label>Status<select name="payment_status" defaultValue="pending"><option value="pending">Pendente</option><option value="paid">Recebido</option><option value="overdue">Atrasado</option></select></label>
            <label className="span2">Observações<textarea name="notes" rows={3} /></label>
            <div className="formActions"><button className="button primary">Salvar receita</button></div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panelHeader"><h2>{type === 'receitas' ? 'Receitas' : 'Despesas'} lançadas</h2><span className="badge neutral">{count}</span></div>
        <form className="filters" method="get">
          <input type="hidden" name="tipo" value={type} />
          <label>Unidade<select name="unit" defaultValue={params.unit ?? ''}><option value="">Todas</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={params.status ?? 'all'}><option value="all">Todos</option><option value="pending">Pendente</option><option value="paid">Pago/recebido</option><option value="overdue">Atrasado</option><option value="cancelled">Cancelado</option></select></label>
          <label>De<input type="date" name="from" defaultValue={params.from} /></label>
          <label>Até<input type="date" name="to" defaultValue={params.to} /></label>
          <button className="button secondary">Filtrar</button><Link className="button linkButton" href={`/financeiro?tipo=${type}`}>Limpar</Link>
        </form>
        <div className="tableWrap">
          {type === 'despesas' ? (
            <table><thead><tr><th>Data</th><th>Unidade</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>
              {rows?.map((e: any) => <tr key={e.id}><td>{dateBR(e.expense_date)}</td><td>{e.units?.name}</td><td>{e.financial_categories?.name}</td><td>{e.description}</td><td>{currency(e.amount)}</td><td><span className={`badge ${e.payment_status}`}>{e.payment_status}</span></td><td><Link className="tableLink" href={`/financeiro/despesas/${e.id}`}>Abrir</Link></td></tr>)}
              {!rows?.length && <tr><td colSpan={7} className="empty">Nenhuma despesa encontrada.</td></tr>}
            </tbody></table>
          ) : (
            <table><thead><tr><th>Prevista</th><th>Unidade</th><th>Descrição</th><th>Canal</th><th>Bruto</th><th>Líquido</th><th>Status</th><th>Ação</th></tr></thead><tbody>
              {rows?.map((r: any) => <tr key={r.id}><td>{dateBR(r.expected_date)}</td><td>{r.units?.name}</td><td>{r.description}</td><td><span className={`badge ${r.channel}`}>{r.channel}</span></td><td>{currency(r.gross_amount)}</td><td>{currency(r.net_amount)}</td><td><span className={`badge ${r.payment_status}`}>{r.payment_status}</span></td><td>{r.payment_status !== 'paid' && r.payment_status !== 'cancelled' ? <form action={markRevenueReceivedAction} className="inlineForm"><input type="hidden" name="id" value={r.id} /><input type="date" name="received_date" defaultValue={todayISO()} aria-label="Data recebida" /><button className="button small secondary">Conciliar</button></form> : '—'}</td></tr>)}
              {!rows?.length && <tr><td colSpan={8} className="empty">Nenhuma receita encontrada.</td></tr>}
            </tbody></table>
          )}
        </div>
        <Pagination basePath="/financeiro" page={page} totalPages={totalPages(count)} searchParams={{ ...params, tipo: type }} />
      </section>
    </>
  )
}
