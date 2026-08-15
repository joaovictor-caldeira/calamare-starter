import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cancelReservationAction, updateReservationAction } from '@/actions/reservations'
import { AuditTrail } from '@/components/AuditTrail'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { currency } from '@/lib/format'

export default async function ReservationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { id } = await params
  const messages = await searchParams
  const { supabase } = await requireUser()

  const [{ data: reservation }, { data: units }, { data: revenue }, { data: logs }] = await Promise.all([
    supabase.from('reservations').select('*, units(name), clients(name)').eq('id', id).single(),
    supabase.from('units').select('id, name, properties(name)').eq('status', 'active').order('name'),
    supabase.from('revenues').select('*').eq('reservation_id', id).maybeSingle(),
    supabase.from('audit_logs').select('*').eq('table_name', 'reservations').eq('record_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  if (!reservation) notFound()
  const net = Number(reservation.lodging_amount) + Number(reservation.cleaning_fee) + Number(reservation.extra_fees) - Number(reservation.discounts) - Number(reservation.platform_commission)

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">RESERVA</p><h1>{reservation.guest_name}</h1><p className="muted">{reservation.units?.name} — {reservation.clients?.name}</p></div><div className="headerValue"><small>Líquido previsto</small><strong>{currency(net)}</strong></div></header>
      <div className="actionRow noPrint"><Link className="button secondary" href="/reservas">Voltar</Link><Link className="button secondary" href="/calendario">Ver calendário</Link></div>
      <Feedback erro={messages.erro} sucesso={messages.sucesso} />

      <section className="panel"><div className="panelHeader"><h2>Editar reserva</h2><span className={`badge ${reservation.status}`}>{reservation.status}</span></div>
        <form action={updateReservationAction} className="formGrid">
          <input type="hidden" name="id" value={reservation.id} />
          <label>Unidade*<select name="unit_id" defaultValue={reservation.unit_id} required>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label>
          <label>Hóspede*<input name="guest_name" required defaultValue={reservation.guest_name} /></label>
          <label>Quantidade<input type="number" min="1" name="guest_count" defaultValue={reservation.guest_count} /></label>
          <label>Telefone<input name="guest_phone" defaultValue={reservation.guest_phone ?? ''} /></label>
          <label>E-mail<input type="email" name="guest_email" defaultValue={reservation.guest_email ?? ''} /></label>
          <label>Canal<select name="channel" defaultValue={reservation.channel}><option value="direct">Reserva direta</option><option value="airbnb">Airbnb</option><option value="booking">Booking.com</option><option value="owner_block">Bloqueio do proprietário</option></select></label>
          <label>Código externo<input name="external_code" defaultValue={reservation.external_code ?? ''} /></label>
          <label>Check-in<input type="date" name="check_in" required defaultValue={reservation.check_in} /></label>
          <label>Check-out<input type="date" name="check_out" required defaultValue={reservation.check_out} /></label>
          <label>Hospedagem<input type="number" step="0.01" min="0" name="lodging_amount" defaultValue={reservation.lodging_amount} /></label>
          <label>Limpeza<input type="number" step="0.01" min="0" name="cleaning_fee" defaultValue={reservation.cleaning_fee} /></label>
          <label>Taxas extras<input type="number" step="0.01" min="0" name="extra_fees" defaultValue={reservation.extra_fees} /></label>
          <label>Descontos<input type="number" step="0.01" min="0" name="discounts" defaultValue={reservation.discounts} /></label>
          <label>Comissão do canal<input type="number" step="0.01" min="0" name="platform_commission" defaultValue={reservation.platform_commission} /></label>
          <label>Status<select name="status" defaultValue={reservation.status} disabled={reservation.status === 'cancelled'}><option value="pending">Pendente</option><option value="confirmed">Confirmada</option><option value="checked_in">Em hospedagem</option><option value="checked_out">Finalizada</option><option value="cancelled">Cancelada</option></select>{reservation.status === 'cancelled' && <input type="hidden" name="status" value="cancelled" />}</label>
          <label>Pagamento<select name="payment_status" defaultValue={reservation.payment_status}><option value="pending">Pendente</option><option value="paid">Pago</option><option value="overdue">Atrasado</option><option value="cancelled">Cancelado</option></select></label>
          <label className="span2">Observações<textarea name="notes" rows={4} defaultValue={reservation.notes ?? ''} /></label>
          <div className="formActions"><button className="button primary" disabled={reservation.status === 'cancelled'}>Salvar alterações</button></div>
        </form>
      </section>

      <section className="panel"><div className="panelHeader"><h2>Receita vinculada</h2></div>
        {revenue ? <div className="summaryGrid"><div><small>Bruto</small><strong>{currency(revenue.gross_amount)}</strong></div><div><small>Comissão</small><strong>{currency(revenue.platform_commission)}</strong></div><div><small>Descontos</small><strong>{currency(revenue.discounts)}</strong></div><div><small>Líquido</small><strong>{currency(revenue.net_amount)}</strong></div><div><small>Pagamento</small><span className={`badge ${revenue.payment_status}`}>{revenue.payment_status}</span></div></div> : <p className="empty">A receita será criada automaticamente após a migração financeira.</p>}
      </section>

      {reservation.status !== 'cancelled' && <section className="panel dangerZone"><div><h2>Cancelar reserva</h2><p className="muted">A reserva permanecerá no histórico, liberará as datas e cancelará a receita vinculada.</p></div><form action={cancelReservationAction} className="inlineForm"><input type="hidden" name="id" value={reservation.id} /><input name="cancellation_reason" required placeholder="Motivo do cancelamento" /><ConfirmButton label="Cancelar reserva" confirmMessage="Confirma o cancelamento desta reserva?" /></form></section>}
      {reservation.status === 'cancelled' && <section className="panel"><h2>Motivo do cancelamento</h2><p>{reservation.cancellation_reason ?? 'Não informado'}</p></section>}
      <AuditTrail logs={logs ?? []} />
    </>
  )
}
