import { createExpenseAction } from '@/actions/expenses'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { currency, dateBR, todayISO } from '@/lib/format'

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const [{ data: units }, { data: categories }, { data: expenses }] = await Promise.all([
    supabase.from('units').select('id, name, properties(name)').eq('status', 'active').order('name'),
    supabase.from('financial_categories').select('id, name').eq('type', 'expense').order('name'),
    supabase.from('expenses').select('*, units(name), financial_categories(name)').order('expense_date', { ascending: false }).limit(100),
  ])
  const total = (expenses ?? []).reduce((sum: number, e: any) => sum + Number(e.amount), 0)

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">CONTROLE</p><h1>Financeiro</h1><p className="muted">Lançamento de despesas por unidade.</p></div><div className="headerValue"><small>Total listado</small><strong>{currency(total)}</strong></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />
      <section className="panel"><div className="panelHeader"><h2>Nova despesa</h2></div>
        <form action={createExpenseAction} className="formGrid">
          <label>Unidade*<select name="unit_id" required><option value="">Selecione</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label>
          <label>Categoria*<select name="category_id" required><option value="">Selecione</option>{categories?.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label>Descrição*<input name="description" required /></label>
          <label>Fornecedor<input name="supplier" /></label>
          <label>Valor (R$)*<input type="number" step="0.01" min="0.01" name="amount" required /></label>
          <label>Data*<input type="date" name="expense_date" defaultValue={todayISO()} required /></label>
          <label className="checkbox"><input type="checkbox" name="charge_owner" defaultChecked /> Descontar do proprietário</label>
          <div className="formActions"><button className="button primary">Salvar despesa</button></div>
        </form>
      </section>
      <section className="panel"><div className="panelHeader"><h2>Despesas lançadas</h2></div>
        <div className="tableWrap"><table><thead><tr><th>Data</th><th>Unidade</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Proprietário</th></tr></thead>
          <tbody>{expenses?.map((e: any) => <tr key={e.id}><td>{dateBR(e.expense_date)}</td><td>{e.units?.name}</td><td>{e.financial_categories?.name}</td><td>{e.description}</td><td>{currency(e.amount)}</td><td>{e.charge_owner ? 'Descontar' : 'Não descontar'}</td></tr>)}
          {!expenses?.length && <tr><td colSpan={6} className="empty">Nenhuma despesa cadastrada.</td></tr>}</tbody>
        </table></div>
      </section>
    </>
  )
}
