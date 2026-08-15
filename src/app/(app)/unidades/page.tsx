import Link from 'next/link'
import { createPropertyAction, createUnitAction } from '@/actions/units'
import { Feedback } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { requireUser } from '@/lib/auth'
import { currency } from '@/lib/format'
import { pageRange, positiveInteger, totalPages } from '@/lib/pagination'

export const metadata = { title: 'Imóveis e unidades' }

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; q?: string; client?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const page = positiveInteger(params.page)
  const { from, to } = pageRange(page)

  const [{ data: clients }, { data: properties }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('properties').select('id, name, client_id, clients(name)').eq('status', 'active').order('name'),
  ])

  let unitsQuery = supabase
    .from('units')
    .select('*, properties(id, name), clients(id, name)', { count: 'exact' })
    .order('name')
    .range(from, to)

  if (params.status && params.status !== 'all') unitsQuery = unitsQuery.eq('status', params.status)
  if (params.client) unitsQuery = unitsQuery.eq('client_id', params.client)
  if (params.q?.trim()) unitsQuery = unitsQuery.ilike('name', `%${params.q.trim()}%`)

  const { data: units, count } = await unitsQuery
  const pages = totalPages(count ?? 0)

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">PORTFÓLIO</p><h1>Imóveis e unidades</h1><p className="muted">Cadastre primeiro o imóvel físico e depois cada unidade administrada.</p></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />

      <div className="twoColumns">
        <section className="panel"><div className="panelHeader"><h2>1. Novo imóvel</h2></div>
          <form action={createPropertyAction} className="formStack">
            <label>Cliente*<select name="client_id" required><option value="">Selecione</option>{clients?.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            <label>Nome do imóvel*<input name="name" required placeholder="Ex.: Edifício Sky Concept" /></label>
            <label>Código interno<input name="internal_code" placeholder="SKY" /></label>
            <label>Endereço<input name="address" /></label>
            <div className="formGrid compact"><label>Cidade<input name="city" /></label><label>UF<input name="state" maxLength={2} /></label></div>
            <label>Link de localização<input type="url" name="location_url" /></label>
            <label>Observações<textarea name="notes" rows={3} /></label>
            <button className="button primary">Salvar imóvel</button>
          </form>
        </section>
        <section className="panel"><div className="panelHeader"><h2>2. Nova unidade</h2></div>
          <form action={createUnitAction} className="formStack">
            <label>Imóvel*<select name="property_id" required><option value="">Selecione</option>{properties?.map((p: any) => <option value={p.id} key={p.id}>{p.name} — {p.clients?.name}</option>)}</select></label>
            <label>Nome da unidade*<input name="name" required placeholder="Ex.: Apartamento 615" /></label>
            <label>Código interno<input name="internal_code" placeholder="SKY-615" /></label>
            <div className="formGrid compact"><label>Quartos<input type="number" min="0" name="rooms" defaultValue="1" /></label><label>Camas<input type="number" min="0" name="beds" defaultValue="1" /></label></div>
            <label>Capacidade<input type="number" min="1" name="capacity" defaultValue="4" /></label>
            <div className="formGrid compact"><label>Check-in<input type="time" name="check_in_time" defaultValue="14:00" /></label><label>Check-out<input type="time" name="check_out_time" defaultValue="11:00" /></label></div>
            <div className="formGrid compact"><label>Diária padrão<input type="number" step="0.01" name="default_rate" defaultValue="0" /></label><label>Taxa de limpeza<input type="number" step="0.01" name="cleaning_fee" defaultValue="0" /></label></div>
            <label>Caução<input type="number" step="0.01" name="security_deposit" defaultValue="0" /></label>
            <button className="button primary">Salvar unidade</button>
          </form>
        </section>
      </div>

      <section className="panel"><div className="panelHeader"><h2>Unidades cadastradas</h2><span className="badge neutral">{count ?? 0}</span></div>
        <form className="filters" method="get">
          <label>Busca<input name="q" defaultValue={params.q} placeholder="Nome da unidade" /></label>
          <label>Cliente<select name="client" defaultValue={params.client ?? ''}><option value="">Todos</option>{clients?.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={params.status ?? 'all'}><option value="all">Todos</option><option value="active">Ativas</option><option value="inactive">Inativas</option></select></label>
          <button className="button secondary">Filtrar</button><Link className="button linkButton" href="/unidades">Limpar</Link>
        </form>
        <div className="tableWrap"><table><thead><tr><th>Unidade</th><th>Imóvel</th><th>Cliente</th><th>Capacidade</th><th>Diária</th><th>Status</th><th></th></tr></thead>
          <tbody>{units?.map((unit: any) => <tr key={unit.id}><td><strong>{unit.name}</strong><small className="block muted">{unit.internal_code || 'Sem código'}</small></td><td><Link className="tableLink" href={`/imoveis/${unit.properties?.id}`}>{unit.properties?.name}</Link></td><td>{unit.clients?.name}</td><td>{unit.capacity} hóspedes</td><td>{currency(unit.default_rate)}</td><td><span className={`badge ${unit.status === 'active' ? 'confirmed' : 'cancelled'}`}>{unit.status}</span></td><td><Link className="tableLink" href={`/unidades/${unit.id}`}>Abrir</Link></td></tr>)}
          {!units?.length && <tr><td colSpan={7} className="empty">Nenhuma unidade encontrada.</td></tr>}</tbody>
        </table></div>
        <Pagination basePath="/unidades" page={page} totalPages={pages} searchParams={params} />
      </section>
    </>
  )
}
