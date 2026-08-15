import Link from 'next/link'
import { createClientAction } from '@/actions/clients'
import { Feedback } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { requireUser } from '@/lib/auth'
import { pageRange, positiveInteger, totalPages } from '@/lib/pagination'

export const metadata = { title: 'Clientes' }

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string; q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const page = positiveInteger(params.page)
  const { from, to } = pageRange(page)

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .order('name')
    .range(from, to)

  if (params.status && params.status !== 'all') query = query.eq('status', params.status)
  if (params.q?.trim()) {
    const q = params.q.trim().replaceAll(',', ' ')
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,cpf_cnpj.ilike.%${q}%`)
  }

  const { data: clients, count } = await query
  const pages = totalPages(count ?? 0)

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">CADASTROS</p><h1>Clientes e proprietários</h1><p className="muted">A JOCA administra vários clientes, cada um com seus próprios imóveis.</p></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />

      <section className="panel">
        <div className="panelHeader"><h2>Novo cliente</h2></div>
        <form action={createClientAction} className="formGrid">
          <label>Nome completo ou razão social*<input name="name" required /></label>
          <label>CPF ou CNPJ<input name="cpf_cnpj" /></label>
          <label>E-mail<input type="email" name="email" /></label>
          <label>Telefone<input name="phone" /></label>
          <label>Endereço<input name="address" /></label>
          <label>Modelo da comissão<select name="management_fee_type" defaultValue="percentage"><option value="percentage">Percentual</option><option value="fixed">Valor fixo</option></select></label>
          <label>Comissão<input type="number" step="0.01" min="0" name="management_fee" defaultValue="20" /></label>
          <label>Base da comissão<select name="management_fee_base" defaultValue="net_channels"><option value="net_channels">Após taxas dos canais</option><option value="gross">Receita bruta</option></select></label>
          <label>Reserva de emergência padrão<input type="number" step="0.01" min="0" name="emergency_reserve_default" defaultValue="0" /></label>
          <label>Dia de fechamento<input type="number" min="1" max="28" name="closing_day" defaultValue="15" /></label>
          <label>Dia de repasse<input type="number" min="1" max="28" name="payout_day" defaultValue="20" /></label>
          <label className="span2">Observações<textarea name="notes" rows={3} /></label>
          <div className="formActions"><button className="button primary">Salvar cliente</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>Clientes cadastrados</h2><span className="badge neutral">{count ?? 0}</span></div>
        <form className="filters" method="get">
          <label>Busca<input name="q" defaultValue={params.q} placeholder="Nome, e-mail, telefone ou documento" /></label>
          <label>Status<select name="status" defaultValue={params.status ?? 'all'}><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label>
          <button className="button secondary">Filtrar</button>
          <Link className="button linkButton" href="/clientes">Limpar</Link>
        </form>
        <div className="tableWrap"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Comissão</th><th>Fechamento</th><th>Status</th><th></th></tr></thead>
          <tbody>{clients?.map((client: any) => <tr key={client.id}><td><strong>{client.name}</strong><small className="block muted">{client.cpf_cnpj || 'Sem documento'}</small></td><td>{client.email || client.phone || '—'}</td><td>{client.management_fee_type === 'fixed' ? `R$ ${client.management_fee_value}` : `${client.management_fee_value}%`}</td><td>Dia {client.closing_day}</td><td><span className={`badge ${client.status === 'active' ? 'confirmed' : 'cancelled'}`}>{client.status}</span></td><td><Link className="tableLink" href={`/clientes/${client.id}`}>Abrir</Link></td></tr>)}
          {!clients?.length && <tr><td colSpan={6} className="empty">Nenhum cliente encontrado.</td></tr>}</tbody>
        </table></div>
        <Pagination basePath="/clientes" page={page} totalPages={pages} searchParams={params} />
      </section>
    </>
  )
}
