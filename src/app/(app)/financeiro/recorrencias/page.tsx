import Link from 'next/link'
import { createRecurringExpenseAction, generateRecurringExpensesAction, setRecurringExpenseActiveAction } from '@/actions/expenses'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { currency, dateBR, todayISO } from '@/lib/format'

export const metadata = { title: 'Despesas recorrentes' }

export default async function RecurringExpensesPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const [{ data: units }, { data: categories }, { data: recurring }] = await Promise.all([
    supabase.from('units').select('id, name, properties(name)').eq('status', 'active').order('name'),
    supabase.from('financial_categories').select('id, name').eq('type', 'expense').order('name'),
    supabase.from('recurring_expenses').select('*, units(name), financial_categories(name)').order('next_due_date'),
  ])

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">AUTOMAÇÃO FINANCEIRA</p><h1>Despesas recorrentes</h1><p className="muted">Cadastre condomínio, internet, energia fixa e outros compromissos repetitivos.</p></div><Link className="button secondary" href="/financeiro">Voltar</Link></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />
      <section className="panel"><div className="panelHeader"><h2>Nova recorrência</h2></div>
        <form action={createRecurringExpenseAction} className="formGrid">
          <label>Unidade*<select name="unit_id" required><option value="">Selecione</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label>
          <label>Categoria*<select name="category_id" required><option value="">Selecione</option>{categories?.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label>Descrição*<input name="description" required /></label>
          <label>Fornecedor<input name="supplier" /></label>
          <label>Valor*<input type="number" step="0.01" min="0.01" name="amount" required /></label>
          <label>Frequência<select name="frequency" defaultValue="monthly"><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></label>
          <label>Início<input type="date" name="start_date" defaultValue={todayISO()} required /></label>
          <label>Próximo vencimento<input type="date" name="next_due_date" defaultValue={todayISO()} required /></label>
          <label>Fim opcional<input type="date" name="end_date" /></label>
          <label>Forma de pagamento<input name="payment_method" /></label>
          <label className="checkbox"><input type="checkbox" name="charge_owner" defaultChecked /> Descontar do proprietário</label>
          <div className="formActions"><button className="button primary">Salvar recorrência</button></div>
        </form>
      </section>
      <section className="panel"><div className="panelHeader"><div><h2>Gerar vencimentos</h2><p className="muted">O botão cria apenas despesas ainda não geradas, evitando duplicidade.</p></div></div>
        <form action={generateRecurringExpensesAction} className="inlineForm"><label>Gerar até<input type="date" name="through_date" defaultValue={todayISO()} /></label><button className="button primary">Gerar despesas vencidas</button></form>
      </section>
      <section className="panel"><div className="panelHeader"><h2>Recorrências cadastradas</h2><span className="badge neutral">{recurring?.length ?? 0}</span></div>
        <div className="tableWrap"><table><thead><tr><th>Unidade</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Frequência</th><th>Próximo vencimento</th><th>Status</th><th></th></tr></thead><tbody>
          {recurring?.map((item: any) => <tr key={item.id}><td>{item.units?.name}</td><td>{item.description}</td><td>{item.financial_categories?.name}</td><td>{currency(item.amount)}</td><td>{item.frequency}</td><td>{dateBR(item.next_due_date)}</td><td><span className={`badge ${item.active ? 'confirmed' : 'cancelled'}`}>{item.active ? 'ativa' : 'pausada'}</span></td><td><form action={setRecurringExpenseActiveAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="active" value={String(!item.active)} /><button className="button small secondary">{item.active ? 'Pausar' : 'Reativar'}</button></form></td></tr>)}
          {!recurring?.length && <tr><td colSpan={8} className="empty">Nenhuma recorrência cadastrada.</td></tr>}
        </tbody></table></div>
      </section>
    </>
  )
}
