import Link from 'next/link'
import { createInventoryItemAction } from '@/actions/inventory'
import { Feedback } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { requireUser } from '@/lib/auth'
import { currency, dateBR, todayISO } from '@/lib/format'
import { pageRange, positiveInteger, totalPages } from '@/lib/pagination'

export const metadata = { title: 'Inventário' }

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string; unit?: string; condition?: string; alert?: string; page?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const page = positiveInteger(params.page)
  const { from, to } = pageRange(page)
  const { data: units } = await supabase.from('units').select('id, name, properties(name)').eq('status', 'active').order('name')

  let query = supabase.from('inventory_items').select('*, units(name)', { count: 'exact' }).eq('active', true).order('name').range(from, to)
  if (params.unit) query = query.eq('unit_id', params.unit)
  if (params.condition && params.condition !== 'all') query = query.eq('condition', params.condition)
  if (params.alert === 'stock') query = query.eq('needs_restock', true)
  if (params.alert === 'warranty') {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    query = query.lte('warranty_until', date.toISOString().slice(0, 10)).gte('warranty_until', todayISO())
  }
  const { data: items, count } = await query

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">PATRIMÔNIO</p><h1>Inventário e estoque</h1><p className="muted">Controle itens, quantidades, estado, notas fiscais e garantias por unidade.</p></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />
      <section className="panel"><div className="panelHeader"><h2>Novo item</h2></div><form action={createInventoryItemAction} className="formGrid" encType="multipart/form-data"><label>Unidade*<select name="unit_id" required><option value="">Selecione</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label><label>Item*<input name="name" required /></label><label>Categoria<input name="category" placeholder="Enxoval, eletrodoméstico..." /></label><label>Quantidade<input type="number" min="0" step="0.01" name="quantity" defaultValue="1" /></label><label>Estoque mínimo<input type="number" min="0" step="0.01" name="minimum_quantity" defaultValue="0" /></label><label>Condição<select name="condition" defaultValue="good"><option value="new">Novo</option><option value="good">Bom</option><option value="fair">Regular</option><option value="damaged">Danificado</option><option value="discarded">Descartado</option></select></label><label>Data da compra<input type="date" name="purchase_date" /></label><label>Valor da compra<input type="number" min="0" step="0.01" name="purchase_value" /></label><label>Garantia até<input type="date" name="warranty_until" /></label><label>Local no imóvel<input name="location_in_unit" /></label><label>Nota fiscal<input type="file" name="invoice" accept="image/*,.pdf" /></label><label>Foto<input type="file" name="photo" accept="image/*" /></label><label className="span2">Observações<textarea name="notes" rows={3} /></label><div className="formActions"><button className="button primary">Salvar item</button></div></form></section>
      <section className="panel"><form className="filters" method="get"><label>Unidade<select name="unit" defaultValue={params.unit ?? ''}><option value="">Todas</option>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name}</option>)}</select></label><label>Condição<select name="condition" defaultValue={params.condition ?? 'all'}><option value="all">Todas</option><option value="new">Novo</option><option value="good">Bom</option><option value="fair">Regular</option><option value="damaged">Danificado</option><option value="discarded">Descartado</option></select></label><label>Alerta<select name="alert" defaultValue={params.alert ?? ''}><option value="">Todos</option><option value="stock">Estoque baixo</option><option value="warranty">Garantia em 30 dias</option></select></label><button className="button secondary">Filtrar</button><Link className="button linkButton" href="/inventario">Limpar</Link></form></section>
      <section className="panel"><div className="panelHeader"><h2>Itens cadastrados</h2><span className="badge neutral">{count ?? 0}</span></div><div className="tableWrap"><table><thead><tr><th>Unidade</th><th>Item</th><th>Categoria</th><th>Quantidade</th><th>Condição</th><th>Valor</th><th>Garantia</th><th>Alerta</th><th></th></tr></thead><tbody>{items?.map((item: any) => { const low = Number(item.quantity) <= Number(item.minimum_quantity) && Number(item.minimum_quantity) > 0; return <tr key={item.id}><td>{item.units?.name}</td><td>{item.name}</td><td>{item.category}</td><td>{item.quantity}</td><td><span className={`badge ${item.condition === 'damaged' ? 'cancelled' : 'neutral'}`}>{item.condition}</span></td><td>{currency(item.purchase_value)}</td><td>{dateBR(item.warranty_until)}</td><td>{low ? <span className="badge cancelled">Reposição</span> : '—'}</td><td><Link className="tableLink" href={`/inventario/${item.id}`}>Abrir</Link></td></tr>})}{!items?.length && <tr><td colSpan={9} className="empty">Nenhum item encontrado.</td></tr>}</tbody></table></div><Pagination basePath="/inventario" page={page} totalPages={totalPages(count ?? 0)} searchParams={params} /></section>
    </>
  )
}
