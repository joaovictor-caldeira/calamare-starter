import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cancelExpenseAction, updateExpenseAction } from '@/actions/expenses'
import { AuditTrail } from '@/components/AuditTrail'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { signedFileUrl } from '@/lib/storage'

export default async function ExpenseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { id } = await params
  const messages = await searchParams
  const { supabase } = await requireUser()

  const [{ data: expense }, { data: units }, { data: categories }, { data: logs }] = await Promise.all([
    supabase.from('expenses').select('*, units(name), financial_categories(name)').eq('id', id).single(),
    supabase.from('units').select('id, name, properties(name)').eq('status', 'active').order('name'),
    supabase.from('financial_categories').select('id, name').eq('type', 'expense').order('name'),
    supabase.from('audit_logs').select('*').eq('table_name', 'expenses').eq('record_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  if (!expense) notFound()
  const receiptUrl = await signedFileUrl(supabase, expense.receipt_path)

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">DESPESA</p><h1>{expense.description}</h1><p className="muted">{expense.units?.name} — {expense.financial_categories?.name}</p></div><Link className="button secondary" href="/financeiro?tipo=despesas">Voltar</Link></header>
      <Feedback erro={messages.erro} sucesso={messages.sucesso} />
      <section className="panel"><div className="panelHeader"><h2>Editar despesa</h2><span className={`badge ${expense.payment_status}`}>{expense.payment_status}</span></div>
        <form action={updateExpenseAction} className="formGrid" encType="multipart/form-data">
          <input type="hidden" name="id" value={expense.id} />
          <label>Unidade*<select name="unit_id" defaultValue={expense.unit_id}>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label>
          <label>Categoria*<select name="category_id" defaultValue={expense.category_id}>{categories?.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label>Descrição*<input name="description" required defaultValue={expense.description} /></label>
          <label>Fornecedor<input name="supplier" defaultValue={expense.supplier ?? ''} /></label>
          <label>Valor*<input type="number" step="0.01" min="0.01" name="amount" required defaultValue={expense.amount} /></label>
          <label>Data*<input type="date" name="expense_date" required defaultValue={expense.expense_date} /></label>
          <label>Forma de pagamento<input name="payment_method" defaultValue={expense.payment_method ?? ''} /></label>
          <label>Status<select name="payment_status" defaultValue={expense.payment_status}><option value="pending">Pendente</option><option value="paid">Pago</option><option value="overdue">Atrasado</option><option value="cancelled">Cancelado</option></select></label>
          <label>Novo comprovante<input type="file" name="receipt" accept="image/*,.pdf" /></label>
          <label className="checkbox"><input type="checkbox" name="charge_owner" defaultChecked={expense.charge_owner} /> Descontar do proprietário</label>
          <label className="span2">Observações<textarea name="notes" rows={4} defaultValue={expense.notes ?? ''} /></label>
          <div className="formActions"><button className="button primary" disabled={expense.payment_status === 'cancelled'}>Salvar alterações</button></div>
        </form>
        {receiptUrl && <p className="topGap"><a className="tableLink" href={receiptUrl} target="_blank" rel="noreferrer">Abrir comprovante atual</a></p>}
      </section>
      {expense.payment_status !== 'cancelled' ? <section className="panel dangerZone"><div><h2>Cancelar lançamento</h2><p className="muted">O registro será preservado e ficará fora dos próximos fechamentos.</p></div><form action={cancelExpenseAction} className="inlineForm"><input type="hidden" name="id" value={expense.id} /><input name="cancellation_reason" required placeholder="Motivo do cancelamento" /><ConfirmButton label="Cancelar despesa" confirmMessage="Confirma o cancelamento deste lançamento?" /></form></section> : <section className="panel"><h2>Motivo do cancelamento</h2><p>{expense.cancellation_reason ?? 'Não informado'}</p></section>}
      <AuditTrail logs={logs ?? []} />
    </>
  )
}
