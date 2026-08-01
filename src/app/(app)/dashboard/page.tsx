import { StatCard } from '@/components/StatCard'
import { requireUser } from '@/lib/auth'
import { currency, dateBR, todayISO } from '@/lib/format'

export default async function DashboardPage() {
  const { supabase } = await requireUser()
  const today = todayISO()
  const monthStart = `${today.slice(0, 7)}-01`
  const nextMonthDate = new Date(`${monthStart}T12:00:00`)
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1)
  const nextMonth = nextMonthDate.toISOString().slice(0, 10)

  const [unitsResult, checkIns, checkOuts, reservationsResult, expensesResult] = await Promise.all([
    supabase.from('units').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_in', today).in('status', ['confirmed', 'checked_in']),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_out', today).in('status', ['confirmed', 'checked_in']),
    supabase.from('reservations').select('lodging_amount, cleaning_fee, extra_fees, discounts, platform_commission, check_in, guest_name, channel, units(name)').gte('check_in', monthStart).lt('check_in', nextMonth).neq('status', 'cancelled').order('check_in', { ascending: false }),
    supabase.from('expenses').select('amount').gte('expense_date', monthStart).lt('expense_date', nextMonth),
  ])

  const reservations = reservationsResult.data ?? []
  const gross = reservations.reduce((sum, r) => sum + Number(r.lodging_amount) + Number(r.cleaning_fee) + Number(r.extra_fees), 0)
  const commissions = reservations.reduce((sum, r) => sum + Number(r.platform_commission) + Number(r.discounts), 0)
  const expenses = (expensesResult.data ?? []).reduce((sum, e) => sum + Number(e.amount), 0)
  const net = gross - commissions - expenses

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">OPERAÇÃO</p><h1>Visão geral</h1><p className="muted">Indicadores atualizados com os dados cadastrados.</p></div></header>
      <section className="statsGrid">
        <StatCard label="Unidades ativas" value={unitsResult.count ?? 0} />
        <StatCard label="Check-ins hoje" value={checkIns.count ?? 0} />
        <StatCard label="Check-outs hoje" value={checkOuts.count ?? 0} />
        <StatCard label="Reservas no mês" value={reservations.length} />
        <StatCard label="Receita bruta" value={currency(gross)} />
        <StatCard label="Despesas" value={currency(expenses)} />
        <StatCard label="Resultado estimado" value={currency(net)} hint="Antes da comissão da administradora" />
      </section>

      <section className="panel">
        <div className="panelHeader"><div><h2>Reservas do mês</h2><p className="muted">Últimos lançamentos</p></div></div>
        <div className="tableWrap">
          <table><thead><tr><th>Check-in</th><th>Hóspede</th><th>Unidade</th><th>Canal</th><th>Valor</th></tr></thead>
            <tbody>{reservations.slice(0, 8).map((r: any, index) => (
              <tr key={index}><td>{dateBR(r.check_in)}</td><td>{r.guest_name}</td><td>{r.units?.name ?? '—'}</td><td><span className={`badge ${r.channel}`}>{r.channel}</span></td><td>{currency(Number(r.lodging_amount) + Number(r.cleaning_fee))}</td></tr>
            ))}{reservations.length === 0 && <tr><td colSpan={5} className="empty">Nenhuma reserva cadastrada neste mês.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </>
  )
}
