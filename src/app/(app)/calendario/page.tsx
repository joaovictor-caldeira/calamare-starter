import { requireUser } from '@/lib/auth'

function iso(date: Date) { return date.toISOString().slice(0, 10) }
function label(date: Date) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' }).format(date) }

export default async function CalendarPage() {
  const { supabase } = await requireUser()
  const start = new Date(); start.setHours(12, 0, 0, 0)
  const dates = Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  const end = new Date(dates.at(-1)!); end.setDate(end.getDate() + 1)

  const [{ data: units }, { data: reservations }] = await Promise.all([
    supabase.from('units').select('id, name').eq('status', 'active').order('name'),
    supabase.from('reservations').select('id, unit_id, guest_name, channel, check_in, check_out, status').lt('check_in', iso(end)).gt('check_out', iso(start)).in('status', ['pending', 'confirmed', 'checked_in']),
  ])

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">MAPA DE OCUPAÇÃO</p><h1>Calendário</h1><p className="muted">Próximos 14 dias. Cada reserva ocupa do check-in até a véspera do check-out.</p></div></header>
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
                return <div className={`calendarCell ${reservation ? reservation.channel : ''}`} key={day} title={reservation ? `${reservation.guest_name} — ${reservation.check_in} a ${reservation.check_out}` : 'Livre'}>{reservation ? <span>{reservation.guest_name.split(' ')[0]}</span> : <small>livre</small>}</div>
              })}
            </div>
          ))}
          {!units?.length && <div className="empty calendarEmpty">Cadastre uma unidade para visualizar o calendário.</div>}
        </div>
      </section>
      <div className="legend"><span><i className="dot airbnb" />Airbnb</span><span><i className="dot booking" />Booking</span><span><i className="dot direct" />Direta</span></div>
    </>
  )
}
