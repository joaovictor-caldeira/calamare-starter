import Link from 'next/link'
import { StatCard } from '@/components/StatCard'
import { requireUser } from '@/lib/auth'
import { currency, dateBR, todayISO } from '@/lib/format'

export const metadata = { title: 'Visão geral' }

export default async function DashboardPage() {
  const { supabase } = await requireUser()
  const today = todayISO()
  const monthStart = `${today.slice(0, 7)}-01`
  const nextMonthDate = new Date(`${monthStart}T12:00:00`)
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1)
  const nextMonth = nextMonthDate.toISOString().slice(0, 10)

  const [unitsResult, checkIns, checkOuts, reservationsResult, revenuesResult, expensesResult, cleaningResult, maintenanceResult, inventoryResult] = await Promise.all([
    supabase.from('units').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_in', today).in('status', ['confirmed', 'checked_in']),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('check_out', today).in('status', ['confirmed', 'checked_in']),
    supabase.from('reservations').select('id, check_in, guest_name, channel, status, units(name)').gte('check_in', monthStart).lt('check_in', nextMonth).neq('status', 'cancelled').order('check_in', { ascending: false }),
    supabase.from('revenues').select('gross_amount, platform_commission, discounts, net_amount').gte('expected_date', monthStart).lt('expected_date', nextMonth).neq('payment_status', 'cancelled'),
    supabase.from('expenses').select('amount, charge_owner').gte('expense_date', monthStart).lt('expense_date', nextMonth).neq('payment_status', 'cancelled'),
    supabase.from('cleaning_tasks').select('id', { count: 'exact', head: true }).in('status', ['waiting','confirmed','in_progress','pending_issue']),
    supabase.from('maintenance_tickets').select('id', { count: 'exact', head: true }).not('status', 'in', '(concluded,cancelled)'),
    supabase.from('inventory_items').select('id, quantity, minimum_quantity, condition').eq('active', true),
  ])

  const revenues = revenuesResult.data ?? []
  const gross = revenues.reduce((sum: number, row: any) => sum + Number(row.gross_amount), 0)
  const channelCosts = revenues.reduce((sum: number, row: any) => sum + Number(row.platform_commission) + Number(row.discounts), 0)
  const expenses = (expensesResult.data ?? []).reduce((sum: number, row: any) => sum + Number(row.amount), 0)
  const estimatedNet = gross - channelCosts - expenses
  const inventoryAlerts = (inventoryResult.data ?? []).filter((item: any) => item.condition === 'damaged' || (Number(item.minimum_quantity) > 0 && Number(item.quantity) <= Number(item.minimum_quantity))).length
  const reservations = reservationsResult.data ?? []

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">OPERAÇÃO JOCA</p><h1>Visão geral</h1><p className="muted">Indicadores consolidados da carteira de clientes e imóveis.</p></div></header>
      <section className="statsGrid">
        <StatCard label="Unidades ativas" value={unitsResult.count ?? 0} />
        <StatCard label="Check-ins hoje" value={checkIns.count ?? 0} />
        <StatCard label="Check-outs hoje" value={checkOuts.count ?? 0} />
        <StatCard label="Reservas no mês" value={reservations.length} />
        <StatCard label="Receita bruta prevista" value={currency(gross)} />
        <StatCard label="Despesas do mês" value={currency(expenses)} />
        <StatCard label="Resultado operacional" value={currency(estimatedNet)} hint="Antes da comissão da JOCA e reserva" />
        <StatCard label="Limpezas pendentes" value={cleaningResult.count ?? 0} />
        <StatCard label="Manutenções abertas" value={maintenanceResult.count ?? 0} />
        <StatCard label="Alertas de inventário" value={inventoryAlerts} />
      </section>
      <div className="twoColumns">
        <section className="panel"><div className="panelHeader"><div><h2>Reservas do mês</h2><p className="muted">Últimos lançamentos</p></div><Link className="tableLink" href="/reservas">Ver todas</Link></div><div className="tableWrap"><table><thead><tr><th>Check-in</th><th>Hóspede</th><th>Unidade</th><th>Canal</th></tr></thead><tbody>{reservations.slice(0, 8).map((r: any) => <tr key={r.id}><td>{dateBR(r.check_in)}</td><td><Link className="tableLink" href={`/reservas/${r.id}`}>{r.guest_name}</Link></td><td>{r.units?.name ?? '—'}</td><td><span className={`badge ${r.channel}`}>{r.channel}</span></td></tr>)}{!reservations.length && <tr><td colSpan={4} className="empty">Nenhuma reserva neste mês.</td></tr>}</tbody></table></div></section>
        <section className="panel"><div className="panelHeader"><h2>Ações rápidas</h2></div><div className="quickLinks"><Link href="/financeiro?tipo=receitas">Conciliar receitas</Link><Link href="/financeiro/recorrencias">Gerar recorrências</Link><Link href="/fechamentos">Criar fechamento</Link><Link href="/limpezas">Acompanhar limpezas</Link><Link href="/manutencoes">Abrir manutenção</Link><Link href="/inventario?alert=stock">Ver estoque baixo</Link></div></section>
      </div>
    </>
  )
}
