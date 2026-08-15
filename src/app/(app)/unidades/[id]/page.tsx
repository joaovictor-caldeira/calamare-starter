import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createCleaningChecklistItemAction, createDefaultCleaningChecklistAction } from '@/actions/cleaning'
import { deleteEmptyUnitAction, setUnitStatusAction, updateUnitAction } from '@/actions/units'
import { AuditTrail } from '@/components/AuditTrail'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'

export default async function UnitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { id } = await params
  const messages = await searchParams
  const { supabase } = await requireUser()

  const [{ data: unit }, { data: properties }, { data: checklist }, { data: logs }] = await Promise.all([
    supabase.from('units').select('*, properties(name), clients(name)').eq('id', id).single(),
    supabase.from('properties').select('id, name, clients(name)').eq('status', 'active').order('name'),
    supabase.from('cleaning_checklist_items').select('*').eq('unit_id', id).eq('active', true).order('sort_order'),
    supabase.from('audit_logs').select('*').eq('table_name', 'units').eq('record_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  if (!unit) notFound()

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">UNIDADE</p><h1>{unit.name}</h1><p className="muted">{unit.properties?.name} — {unit.clients?.name}</p></div><Link className="button secondary" href="/unidades">Voltar</Link></header>
      <Feedback erro={messages.erro} sucesso={messages.sucesso} />
      <section className="panel"><div className="panelHeader"><h2>Editar unidade</h2><span className={`badge ${unit.status === 'active' ? 'confirmed' : 'cancelled'}`}>{unit.status}</span></div>
        <form action={updateUnitAction} className="formGrid">
          <input type="hidden" name="id" value={unit.id} />
          <label>Imóvel*<select name="property_id" defaultValue={unit.property_id} required>{properties?.map((property: any) => <option value={property.id} key={property.id}>{property.name} — {property.clients?.name}</option>)}</select></label>
          <label>Nome*<input name="name" required defaultValue={unit.name} /></label>
          <label>Código interno<input name="internal_code" defaultValue={unit.internal_code ?? ''} /></label>
          <label>Quartos<input type="number" min="0" name="rooms" defaultValue={unit.rooms} /></label>
          <label>Camas<input type="number" min="0" name="beds" defaultValue={unit.beds} /></label>
          <label>Capacidade<input type="number" min="1" name="capacity" defaultValue={unit.capacity} /></label>
          <label>Check-in<input type="time" name="check_in_time" defaultValue={String(unit.check_in_time).slice(0, 5)} /></label>
          <label>Check-out<input type="time" name="check_out_time" defaultValue={String(unit.check_out_time).slice(0, 5)} /></label>
          <label>Diária padrão<input type="number" step="0.01" min="0" name="default_rate" defaultValue={unit.default_rate} /></label>
          <label>Taxa de limpeza<input type="number" step="0.01" min="0" name="cleaning_fee" defaultValue={unit.cleaning_fee} /></label>
          <label>Caução<input type="number" step="0.01" min="0" name="security_deposit" defaultValue={unit.security_deposit} /></label>
          <label>Nome do Wi-Fi<input name="wifi_name" defaultValue={unit.wifi_name ?? ''} /></label>
          <label>Senha do Wi-Fi<input name="wifi_password" defaultValue={unit.wifi_password ?? ''} /></label>
          <label>Código da porta<input name="door_code" defaultValue={unit.door_code ?? ''} /></label>
          <label className="span2">Instruções de acesso<textarea name="access_instructions" rows={4} defaultValue={unit.access_instructions ?? ''} /></label>
          <label>Link Airbnb<input type="url" name="airbnb_url" defaultValue={unit.airbnb_url ?? ''} /></label>
          <label>Link Booking<input type="url" name="booking_url" defaultValue={unit.booking_url ?? ''} /></label>
          <label>Reserva direta<input type="url" name="direct_booking_url" defaultValue={unit.direct_booking_url ?? ''} /></label>
          <label className="span2">Observações<textarea name="notes" rows={4} defaultValue={unit.notes ?? ''} /></label>
          <div className="formActions"><button className="button primary">Salvar alterações</button></div>
        </form>
      </section>

      <section className="panel"><div className="panelHeader"><h2>Checklist padrão de limpeza</h2><span className="badge neutral">{checklist?.length ?? 0}</span></div>
        <div className="checkList">{checklist?.map((item: any) => <div className="checkItem" key={item.id}><span>{item.sort_order}</span><strong>{item.label}</strong></div>)}{!checklist?.length && <p className="empty">Crie o checklist antes das próximas reservas.</p>}</div>
        <div className="actionRow topGap">
          <form action={createCleaningChecklistItemAction} className="inlineForm"><input type="hidden" name="unit_id" value={unit.id} /><input type="number" name="sort_order" min="0" defaultValue={(checklist?.length ?? 0) + 1} aria-label="Ordem" /><input name="label" required placeholder="Novo item do checklist" /><button className="button secondary">Adicionar</button></form>
          {!checklist?.length && <form action={createDefaultCleaningChecklistAction}><input type="hidden" name="unit_id" value={unit.id} /><button className="button primary">Criar checklist padrão</button></form>}
        </div>
      </section>

      <section className="panel dangerZone"><div><h2>Estado da unidade</h2><p className="muted">Inative para interromper novos cadastros sem apagar o histórico.</p></div><div className="actionRow">
        <form action={setUnitStatusAction}><input type="hidden" name="id" value={unit.id} /><input type="hidden" name="status" value={unit.status === 'active' ? 'inactive' : 'active'} /><ConfirmButton label={unit.status === 'active' ? 'Inativar unidade' : 'Reativar unidade'} confirmMessage="Confirma a alteração?" className="button secondary" /></form>
        <form action={deleteEmptyUnitAction}><input type="hidden" name="id" value={unit.id} /><ConfirmButton label="Excluir unidade vazia" confirmMessage="A exclusão só será permitida sem histórico vinculado. Continuar?" /></form>
      </div></section>
      <AuditTrail logs={logs ?? []} />
    </>
  )
}
