import { createReservationAction } from '@/actions/reservations'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { currency, dateBR } from '@/lib/format'

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const [{ data: units }, { data: reservations }] = await Promise.all([
    supabase.from('units').select('id, name, cleaning_fee, properties(name)').eq('status', 'active').order('name'),
    supabase.from('reservations').select('*, units(name)').order('check_in', { ascending: false }).limit(100),
  ])

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">HOSPEDAGENS</p><h1>Reservas</h1><p className="muted">Reservas diretas e importadas dos canais.</p></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />
      <section className="panel"><div className="panelHeader"><h2>Nova reserva direta</h2></div>
        <form action={createReservationAction} className="formGrid">
          <label>Unidade*<select name="unit_id" required><option value="">Selecione</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label>
          <label>Nome do hóspede*<input name="guest_name" required /></label>
          <label>Telefone<input name="guest_phone" /></label>
          <label>Canal<select name="channel" defaultValue="direct"><option value="direct">Reserva direta</option><option value="airbnb">Airbnb</option><option value="booking">Booking.com</option></select></label>
          <label>Check-in*<input type="date" name="check_in" required /></label>
          <label>Check-out*<input type="date" name="check_out" required /></label>
          <label>Hospedagem (R$)<input type="number" step="0.01" name="lodging_amount" defaultValue="0" /></label>
          <label>Taxa de limpeza (R$)<input type="number" step="0.01" name="cleaning_fee" defaultValue="0" /></label>
          <label>Comissão da plataforma (R$)<input type="number" step="0.01" name="platform_commission" defaultValue="0" /></label>
          <label>Status<select name="status" defaultValue="confirmed"><option value="pending">Pendente</option><option value="confirmed">Confirmada</option><option value="checked_in">Em hospedagem</option></select></label>
          <div className="formActions"><button className="button primary">Salvar reserva</button></div>
        </form>
      </section>
      <section className="panel"><div className="panelHeader"><h2>Histórico de reservas</h2><span className="badge neutral">{reservations?.length ?? 0}</span></div>
        <div className="tableWrap"><table><thead><tr><th>Período</th><th>Hóspede</th><th>Unidade</th><th>Canal</th><th>Status</th><th>Total líquido</th></tr></thead>
          <tbody>{reservations?.map((r: any) => <tr key={r.id}><td>{dateBR(r.check_in)} → {dateBR(r.check_out)}</td><td>{r.guest_name}</td><td>{r.units?.name}</td><td><span className={`badge ${r.channel}`}>{r.channel}</span></td><td><span className={`badge ${r.status}`}>{r.status}</span></td><td>{currency(Number(r.lodging_amount) + Number(r.cleaning_fee) + Number(r.extra_fees) - Number(r.discounts) - Number(r.platform_commission))}</td></tr>)}
          {!reservations?.length && <tr><td colSpan={6} className="empty">Nenhuma reserva cadastrada.</td></tr>}</tbody>
        </table></div>
      </section>
    </>
  )
}
