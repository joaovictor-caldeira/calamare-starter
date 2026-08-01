import { createPropertyAction, createUnitAction } from '@/actions/units'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { currency } from '@/lib/format'

export default async function UnitsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const [{ data: clients }, { data: properties }, { data: units }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('properties').select('id, name, city, state, clients(name)').eq('status', 'active').order('name'),
    supabase.from('units').select('*, properties(name), clients(name)').order('name'),
  ])

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">PORTFÓLIO</p><h1>Imóveis e unidades</h1><p className="muted">Primeiro cadastre o imóvel; depois, suas unidades.</p></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />
      <div className="twoColumns">
        <section className="panel"><div className="panelHeader"><h2>1. Novo imóvel</h2></div>
          <form action={createPropertyAction} className="formStack">
            <label>Cliente*<select name="client_id" required><option value="">Selecione</option>{clients?.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            <label>Nome do imóvel*<input name="name" required placeholder="Ex.: Residencial Coralli" /></label>
            <label>Endereço<input name="address" /></label>
            <div className="formGrid compact"><label>Cidade<input name="city" /></label><label>UF<input name="state" maxLength={2} /></label></div>
            <button className="button primary">Salvar imóvel</button>
          </form>
        </section>
        <section className="panel"><div className="panelHeader"><h2>2. Nova unidade</h2></div>
          <form action={createUnitAction} className="formStack">
            <label>Imóvel*<select name="property_id" required><option value="">Selecione</option>{properties?.map((p: any) => <option value={p.id} key={p.id}>{p.name} — {p.clients?.name}</option>)}</select></label>
            <label>Nome da unidade*<input name="name" required placeholder="Ex.: Maréa" /></label>
            <label>Código interno<input name="internal_code" placeholder="MAR-001" /></label>
            <div className="formGrid compact"><label>Quartos<input type="number" min="0" name="rooms" defaultValue="1" /></label><label>Capacidade<input type="number" min="1" name="capacity" defaultValue="4" /></label></div>
            <div className="formGrid compact"><label>Diária padrão<input type="number" step="0.01" name="default_rate" defaultValue="0" /></label><label>Taxa de limpeza<input type="number" step="0.01" name="cleaning_fee" defaultValue="0" /></label></div>
            <button className="button primary">Salvar unidade</button>
          </form>
        </section>
      </div>
      <section className="panel"><div className="panelHeader"><h2>Unidades cadastradas</h2></div>
        <div className="tableWrap"><table><thead><tr><th>Unidade</th><th>Imóvel</th><th>Cliente</th><th>Capacidade</th><th>Diária</th><th>Status</th></tr></thead>
          <tbody>{units?.map((unit: any) => <tr key={unit.id}><td><strong>{unit.name}</strong><small className="block muted">{unit.internal_code || 'Sem código'}</small></td><td>{unit.properties?.name}</td><td>{unit.clients?.name}</td><td>{unit.capacity} hóspedes</td><td>{currency(unit.default_rate)}</td><td><span className="badge confirmed">{unit.status}</span></td></tr>)}
          {!units?.length && <tr><td colSpan={6} className="empty">Cadastre o primeiro imóvel e a primeira unidade.</td></tr>}</tbody>
        </table></div>
      </section>
    </>
  )
}
