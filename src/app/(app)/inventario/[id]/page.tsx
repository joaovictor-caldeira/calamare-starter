import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateInventoryItemAction, uploadInventoryFileAction } from '@/actions/inventory'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { signedFileUrl } from '@/lib/storage'

export default async function InventoryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { id } = await params
  const messages = await searchParams
  const { supabase } = await requireUser()
  const [{ data: item }, { data: units }] = await Promise.all([
    supabase.from('inventory_items').select('*, units(name), clients(name)').eq('id', id).single(),
    supabase.from('units').select('id, name, properties(name)').eq('status', 'active').order('name'),
  ])
  if (!item) notFound()
  const invoiceUrl = await signedFileUrl(supabase, item.invoice_path)
  const photoUrls = (await Promise.all((item.photo_paths ?? []).map((path: string) => signedFileUrl(supabase, path)))).filter(Boolean) as string[]

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">INVENTÁRIO</p><h1>{item.name}</h1><p className="muted">{item.units?.name} — {item.clients?.name}</p></div><Link className="button secondary" href="/inventario">Voltar</Link></header>
      <Feedback erro={messages.erro} sucesso={messages.sucesso} />
      <section className="panel"><div className="panelHeader"><h2>Editar item</h2><span className={`badge ${item.active ? 'confirmed' : 'cancelled'}`}>{item.active ? 'ativo' : 'inativo'}</span></div><form action={updateInventoryItemAction} className="formGrid"><input type="hidden" name="id" value={item.id} /><label>Unidade<select name="unit_id" defaultValue={item.unit_id}>{units?.map((u: any) => <option value={u.id} key={u.id}>{u.name} — {u.properties?.name}</option>)}</select></label><label>Item<input name="name" required defaultValue={item.name} /></label><label>Categoria<input name="category" defaultValue={item.category} /></label><label>Quantidade<input type="number" min="0" step="0.01" name="quantity" defaultValue={item.quantity} /></label><label>Estoque mínimo<input type="number" min="0" step="0.01" name="minimum_quantity" defaultValue={item.minimum_quantity} /></label><label>Condição<select name="condition" defaultValue={item.condition}><option value="new">Novo</option><option value="good">Bom</option><option value="fair">Regular</option><option value="damaged">Danificado</option><option value="discarded">Descartado</option></select></label><label>Data da compra<input type="date" name="purchase_date" defaultValue={item.purchase_date ?? ''} /></label><label>Valor<input type="number" min="0" step="0.01" name="purchase_value" defaultValue={item.purchase_value ?? ''} /></label><label>Garantia até<input type="date" name="warranty_until" defaultValue={item.warranty_until ?? ''} /></label><label>Local<input name="location_in_unit" defaultValue={item.location_in_unit ?? ''} /></label><label>Status<select name="active" defaultValue={String(item.active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label><label className="span2">Observações<textarea name="notes" rows={4} defaultValue={item.notes ?? ''} /></label><div className="formActions"><button className="button primary">Salvar alterações</button></div></form></section>
      <section className="twoColumns"><div className="panel"><div className="panelHeader"><h2>Fotos</h2></div><div className="photoGrid">{photoUrls.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={item.name} /></a>)}</div><form action={uploadInventoryFileAction} className="inlineForm topGap" encType="multipart/form-data"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="kind" value="photo" /><input type="file" name="file" accept="image/*" required /><button className="button secondary">Enviar foto</button></form></div><div className="panel"><div className="panelHeader"><h2>Nota fiscal</h2></div>{invoiceUrl ? <a className="tableLink" href={invoiceUrl} target="_blank" rel="noreferrer">Abrir nota fiscal</a> : <p className="empty">Nenhuma nota fiscal anexada.</p>}<form action={uploadInventoryFileAction} className="inlineForm topGap" encType="multipart/form-data"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="kind" value="invoice" /><input type="file" name="file" accept="image/*,.pdf" required /><button className="button secondary">Enviar nota fiscal</button></form></div></section>
    </>
  )
}
