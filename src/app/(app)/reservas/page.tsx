import Link from 'next/link'
import { createReservationAction } from '@/actions/reservations'
import { Feedback } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { requireUser } from '@/lib/auth'
import { currency, dateBR } from '@/lib/format'
import { pageRange, positiveInteger, totalPages } from '@/lib/pagination'

export const metadata = { title: 'Reservas' }

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; q?: string; unit?: string; channel?: string; status?: string; from?: string; to?: string; page?: string }>
}) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const page = positiveInteger(params.page)
  const { from, to } = pageRange(page)

  const { data: units } = await supabase
    .from('units')
    .select('id, name, cleaning_fee, properties(name)')
    .eq('status', 'active')
    .order('name')

  let query = supabase
    .from('reservations')
    .select('*, units(id, name)', { count: 'exact' })
    .order('check_in', { ascending: false })
    .range(from, to)

  if (params.unit) query = query.eq('unit_id', params.unit)
  if (params.channel && params.channel !== 'all') query = query.eq('channel', params.channel)
  if (params.status && params.status !== 'all') query = query.eq('status', params.status)
  if (params.from) query = query.gte('check_in', params.from)
  if (params.to) query = query.lte('check_in', params.to)
  if (params.q?.trim()) query = query.ilike('guest_name', `%${params.q.trim()}%`)

  const { data: reservations, count } = await query
  const pages = totalPages(count ?? 0)

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">HOSPEDAGENS</p><h1>Reservas</h1><p className="muted">Cadastre, acompanhe, edite e cancele sem apagar o histórico.</p></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />

      <section className="panel"><div className="panelHeader"><h2>Nova reserva</h2></div>
        <form action={createReservationAction} className="formGrid">
          <label>Unidade*<select name="unit_id" required><option value="">Selecione</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label>
          <label>Nome do hóspede*<input name="guest_name" required /></label>
          <label>Quantidade de hóspedes<input type="number" min="1" name="guest_count" defaultValue="1" /></label>
          <label>Telefone<input name="guest_phone" /></label>
          <label>E-mail<input type="email" name="guest_email" /></label>
          <label>Canal<select name="channel" defaultValue="direct"><option value="direct">Reserva direta</option><option value="airbnb">Airbnb</option><option value="booking">Booking.com</option><option value="owner_block">Bloqueio do proprietário</option></select></label>
          <label>Código externo<input name="external_code" /></label>
          <label>Check-in*<input type="date" name="check_in" required /></label>
          <label>Check-out*<input type="date" name="check_out" required /></label>
          <label>Hospedagem<input type="number" step="0.01" min="0" name="lodging_amount" defaultValue="0" /></label>
          <label>Taxa de limpeza<input type="number" step="0.01" min="0" name="cleaning_fee" defaultValue="0" /></label>
          <label>Taxas extras<input type="number" step="0.01" min="0" name="extra_fees" defaultValue="0" /></label>
          <label>Descontos<input type="number" step="0.01" min="0" name="discounts" defaultValue="0" /></label>
          <label>Comissão da plataforma<input type="number" step="0.01" min="0" name="platform_commission" defaultValue="0" /></label>
          <label>Status<select name="status" defaultValue="confirmed"><option value="pending">Pendente</option><option value="confirmed">Confirmada</option><option value="checked_in">Em hospedagem</option></select></label>
          <label>Pagamento<select name="payment_status" defaultValue="pending"><option value="pending">Pendente</option><option value="paid">Pago</option><option value="overdue">Atrasado</option></select></label>
          <label className="span2">Observações<textarea name="notes" rows={3} /></label>
          <div className="formActions"><button className="button primary">Salvar reserva</button></div>
        </form>
      </section>

      <section className="panel"><div className="panelHeader"><h2>Histórico de reservas</h2><span className="badge neutral">{count ?? 0}</span></div>
        <form className="filters" method="get">
          <label>Hóspede<input name="q" defaultValue={params.q} /></label>
          <label>Unidade<select name="unit" defaultValue={params.unit ?? ''}><option value="">Todas</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name}</option>)}</select></label>
          <label>Canal<select name="channel" defaultValue={params.channel ?? 'all'}><option value="all">Todos</option><option value="direct">Direta</option><option value="airbnb">Airbnb</option><option value="booking">Booking</option><option value="owner_block">Proprietário</option></select></label>
          <label>Status<select name="status" defaultValue={params.status ?? 'all'}><option value="all">Todos</option><option value="pending">Pendente</option><option value="confirmed">Confirmada</option><option value="checked_in">Em hospedagem</option><option value="checked_out">Finalizada</option><option value="cancelled">Cancelada</option></select></label>
          <label>De<input type="date" name="from" defaultValue={params.from} /></label>
          <label>Até<input type="date" name="to" defaultValue={params.to} /></label>
          <button className="button secondary">Filtrar</button><Link className="button linkButton" href="/reservas">Limpar</Link>
        </form>
        <div className="tableWrap"><table><thead><tr><th>Período</th><th>Hóspede</th><th>Unidade</th><th>Canal</th><th>Status</th><th>Líquido</th><th></th></tr></thead>
          <tbody>{reservations?.map((r: any) => <tr key={r.id}><td>{dateBR(r.check_in)} → {dateBR(r.check_out)}</td><td><strong>{r.guest_name}</strong><small className="block muted">{r.guest_phone || 'Sem telefone'}</small></td><td>{r.units?.name}</td><td><span className={`badge ${r.channel}`}>{r.channel}</span></td><td><span className={`badge ${r.status}`}>{r.status}</span></td><td>{currency(Number(r.lodging_amount) + Number(r.cleaning_fee) + Number(r.extra_fees) - Number(r.discounts) - Number(r.platform_commission))}</td><td><Link className="tableLink" href={`/reservas/${r.id}`}>Abrir</Link></td></tr>)}
          {!reservations?.length && <tr><td colSpan={7} className="empty">Nenhuma reserva encontrada.</td></tr>}</tbody>
        </table></div>
        <Pagination basePath="/reservas" page={page} totalPages={pages} searchParams={params} />
      </section>
    </>
  )
}
