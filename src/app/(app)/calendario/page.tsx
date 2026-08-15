import Link from 'next/link'
import { requireUser } from '@/lib/auth'

function iso(date: Date) { return date.toISOString().slice(0, 10) }
function label(date: Date) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' }).format(date) }

export const metadata = { title: 'Calendário' }

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ start?: string; days?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const days = Math.min(45, Math.max(7, Number(params.days ?? 21)))
  const start = params.start ? new Date(`${params.start}T12:00:00`) : new Date()
  start.setHours(12, 0, 0, 0)
  const dates = Array.from({ length: days }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  const end = new Date(dates.at(-1)!); end.setDate(end.getDate() + 1)

  const [{ data: units }, { data: reservations }, { data: blocks }] = await Promise.all([
    supabase.from('units').select('id, name').eq('status', 'active').order('name'),
    supabase.from('reservations').select('id, unit_id, guest_name, channel, check_in, check_out, status').lt('check_in', iso(end)).gt('check_out', iso(start)).in('status', ['pending', 'confirmed', 'checked_in']),
    supabase.from('unit_blocks').select('id, unit_id, reason, start_date, end_date').eq('active', true).lt('start_date', iso(end)).gt('end_date', iso(start)),
  ])

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">MAPA DE OCUPAÇÃO</p><h1>Calendário</h1><p className="muted">Reservas e bloqueios operacionais. O check-out pode ser o check-in da próxima hospedagem.</p></div></header>
      <section className="panel noPrint"><form className="filters" method="get"><label>Data inicial<input type="date" name="start" defaultValue={iso(start)} /></label><label>Dias<select name="days" defaultValue={String(days)}><option value="14">14 dias</option><option value="21">21 dias</option><option value="30">30 dias</option><option value="45">45 dias</option></select></label><button className="button secondary">Atualizar</button></form></section>
      <section className="panel calendarPanel">
        <div className="calendarGrid" style={{ gridTemplateColumns: `190px repeat(${dates.length}, minmax(80px, 1fr))` }}>
          <div className="calendarHead stickyCell">Unidade</div>
          {dates.map(d => <div className="calendarHead" key={iso(d)}>{label(d)}</div>)}
          {units?.map((unit: any) => (
            <div className="calendarRow" key={unit.id} style={{ display: 'contents' }}>
              <div className="calendarUnit stickyCell">{unit.name}</div>
              {dates.map(d => {
                const day = iso(d)
                const reservation = reservations?.find((r: any) => r.unit_id === unit.id && r.check_in <= day && r.check_out > day)
                const block = blocks?.find((b: any) => b.unit_id === unit.id && b.start_date <= day && b.end_date > day)
                if (reservation) return <Link href={`/reservas/${reservation.id}`} className={`calendarCell ${reservation.channel}`} key={day} title={`${reservation.guest_name} — ${reservation.check_in} a ${reservation.check_out}`}><span>{reservation.guest_name.split(' ')[0]}</span></Link>
                if (block) return <div className="calendarCell maintenance" key={day} title={block.reason}><span>manutenção</span></div>
                return <div className="calendarCell" key={day} title="Livre"><small>livre</small></div>
              })}
            </div>
          ))}
          {!units?.length && <div className="empty calendarEmpty">Cadastre uma unidade para visualizar o calendário.</div>}
        </div>
      </section>
      <div className="legend"><span><i className="dot airbnb" />Airbnb</span><span><i className="dot booking" />Booking</span><span><i className="dot direct" />Direta</span><span><i className="dot maintenance" />Manutenção</span></div>
    </>
  )
}
