import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteEmptyPropertyAction, setPropertyStatusAction, updatePropertyAction } from '@/actions/units'
import { AuditTrail } from '@/components/AuditTrail'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'

export default async function PropertyDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { id } = await params
  const messages = await searchParams
  const { supabase } = await requireUser()

  const [{ data: property }, { data: clients }, { data: units }, { data: logs }] = await Promise.all([
    supabase.from('properties').select('*, clients(name)').eq('id', id).single(),
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('units').select('id, name, internal_code, capacity, status').eq('property_id', id).order('name'),
    supabase.from('audit_logs').select('*').eq('table_name', 'properties').eq('record_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  if (!property) notFound()

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">IMÓVEL</p><h1>{property.name}</h1><p className="muted">Cliente: {property.clients?.name}</p></div><Link className="button secondary" href="/unidades">Voltar</Link></header>
      <Feedback erro={messages.erro} sucesso={messages.sucesso} />
      <section className="panel">
        <div className="panelHeader"><h2>Editar imóvel</h2><span className={`badge ${property.status === 'active' ? 'confirmed' : 'cancelled'}`}>{property.status}</span></div>
        <form action={updatePropertyAction} className="formGrid">
          <input type="hidden" name="id" value={property.id} />
          <label>Cliente*<select name="client_id" defaultValue={property.client_id} required>{clients?.map((client: any) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
          <label>Nome*<input name="name" required defaultValue={property.name} /></label>
          <label>Código interno<input name="internal_code" defaultValue={property.internal_code ?? ''} /></label>
          <label className="span2">Endereço<input name="address" defaultValue={property.address ?? ''} /></label>
          <label>Cidade<input name="city" defaultValue={property.city ?? ''} /></label>
          <label>UF<input name="state" maxLength={2} defaultValue={property.state ?? ''} /></label>
          <label>Link de localização<input type="url" name="location_url" defaultValue={property.location_url ?? ''} /></label>
          <label className="span2">Observações<textarea name="notes" rows={4} defaultValue={property.notes ?? ''} /></label>
          <div className="formActions"><button className="button primary">Salvar alterações</button></div>
        </form>
      </section>

      <section className="panel"><div className="panelHeader"><h2>Unidades</h2><span className="badge neutral">{units?.length ?? 0}</span></div>
        <div className="cardList">{units?.map((unit: any) => <article className="miniCard" key={unit.id}><div><strong>{unit.name}</strong><small>{unit.internal_code ?? 'Sem código'}</small></div><span>{unit.capacity} hóspedes</span><Link className="tableLink" href={`/unidades/${unit.id}`}>Abrir unidade</Link></article>)}{!units?.length && <p className="empty">Nenhuma unidade vinculada.</p>}</div>
      </section>

      <section className="panel dangerZone"><div><h2>Estado do imóvel</h2><p className="muted">Prefira inativação quando já existir histórico.</p></div><div className="actionRow">
        <form action={setPropertyStatusAction}><input type="hidden" name="id" value={property.id} /><input type="hidden" name="status" value={property.status === 'active' ? 'inactive' : 'active'} /><ConfirmButton label={property.status === 'active' ? 'Inativar imóvel' : 'Reativar imóvel'} confirmMessage="Confirma a alteração?" className="button secondary" /></form>
        <form action={deleteEmptyPropertyAction}><input type="hidden" name="id" value={property.id} /><ConfirmButton label="Excluir imóvel vazio" confirmMessage="A exclusão só será permitida se não houver unidades. Continuar?" /></form>
      </div></section>
      <AuditTrail logs={logs ?? []} />
    </>
  )
}
