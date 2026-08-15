import Link from 'next/link'
import { notFound } from 'next/navigation'
import { approveClosingAction, markPayoutPaidAction } from '@/actions/closings'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { currency, dateBR, dateTimeBR } from '@/lib/format'
import { signedFileUrl } from '@/lib/storage'

const labels: Record<string, string> = {
  revenue: 'Receitas',
  platform_fee: 'Comissões dos canais',
  discount: 'Descontos',
  expense: 'Despesas descontáveis',
  management_fee: 'Comissão da JOCA',
  emergency_reserve: 'Reserva de emergência',
}

export default async function ClosingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { id } = await params
  const messages = await searchParams
  const { supabase } = await requireUser()

  const [{ data: closing }, { data: items }, { data: payout }] = await Promise.all([
    supabase.from('closings').select('*, clients(name, email, phone, payout_day)').eq('id', id).single(),
    supabase.from('closing_items').select('*, units(name)').eq('closing_id', id).order('occurred_on'),
    supabase.from('payouts').select('*').eq('closing_id', id).maybeSingle(),
  ])
  if (!closing) notFound()
  const proofUrl = await signedFileUrl(supabase, payout?.proof_path)
  const groups = Object.entries(labels).map(([type, label]) => ({ type, label, items: (items ?? []).filter((item: any) => item.item_type === type) }))

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">FECHAMENTO</p><h1>{closing.clients?.name}</h1><p className="muted">{dateBR(closing.period_start)} a {dateBR(closing.period_end)}</p></div><div className="headerValue"><small>Líquido do proprietário</small><strong>{currency(closing.owner_net)}</strong></div></header>
      <div className="actionRow noPrint"><Link className="button secondary" href="/fechamentos">Voltar</Link><Link className="button secondary" href={`/relatorios/${closing.id}`}>Abrir relatório</Link></div>
      <Feedback erro={messages.erro} sucesso={messages.sucesso} />

      <section className="summaryGrid">
        <div><small>Receita bruta</small><strong>{currency(closing.gross_revenue)}</strong></div>
        <div><small>Taxas dos canais</small><strong>{currency(closing.platform_fees)}</strong></div>
        <div><small>Descontos</small><strong>{currency(closing.discounts)}</strong></div>
        <div><small>Despesas</small><strong>{currency(closing.operating_expenses)}</strong></div>
        <div><small>Comissão JOCA</small><strong>{currency(closing.management_fee)}</strong></div>
        <div><small>Reserva</small><strong>{currency(closing.emergency_reserve)}</strong></div>
      </section>

      {groups.map((group) => group.items.length > 0 && <section className="panel" key={group.type}><div className="panelHeader"><h2>{group.label}</h2><strong>{currency(group.items.reduce((sum: number, item: any) => sum + Number(item.amount), 0))}</strong></div><div className="tableWrap"><table><thead><tr><th>Data</th><th>Unidade</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>{group.items.map((item: any) => <tr key={item.id}><td>{dateBR(item.occurred_on)}</td><td>{item.units?.name ?? '—'}</td><td>{item.description}</td><td>{currency(item.amount)}</td></tr>)}</tbody></table></div></section>)}

      <section className="panel"><div className="panelHeader"><h2>Aprovação e repasse</h2><span className={`badge ${closing.status === 'approved' || closing.status === 'paid' ? 'confirmed' : 'pending'}`}>{closing.status}</span></div>
        {closing.status === 'open' && <form action={approveClosingAction}><input type="hidden" name="id" value={closing.id} /><ConfirmButton label="Aprovar e bloquear fechamento" confirmMessage="Após a aprovação, os valores não poderão ser recalculados ou editados. Continuar?" className="button primary" /></form>}
        {closing.approved_at && <p>Aprovado em {dateTimeBR(closing.approved_at)}.</p>}
        {payout && <div className="summaryGrid topGap"><div><small>Valor do repasse</small><strong>{currency(payout.amount)}</strong></div><div><small>Data agendada</small><strong>{dateBR(payout.scheduled_date)}</strong></div><div><small>Status</small><span className={`badge ${payout.status === 'paid' ? 'confirmed' : 'pending'}`}>{payout.status}</span></div></div>}
        {payout && payout.status !== 'paid' && <form action={markPayoutPaidAction} className="formGrid topGap" encType="multipart/form-data"><input type="hidden" name="payout_id" value={payout.id} /><input type="hidden" name="closing_id" value={closing.id} /><label>Forma de pagamento<input name="payment_method" placeholder="PIX, TED..." /></label><label>Comprovante<input type="file" name="proof" accept="image/*,.pdf" /></label><label>Observações<input name="notes" /></label><div className="formActions"><ConfirmButton label="Registrar repasse realizado" confirmMessage="Confirma que o valor foi transferido ao proprietário?" className="button primary" /></div></form>}
        {payout?.paid_at && <p className="topGap">Repasse registrado em {dateTimeBR(payout.paid_at)}. {proofUrl && <a className="tableLink" href={proofUrl} target="_blank" rel="noreferrer">Abrir comprovante</a>}</p>}
      </section>
    </>
  )
}
