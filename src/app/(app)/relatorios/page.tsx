import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { currency, dateBR } from '@/lib/format'

export const metadata = { title: 'Relatórios' }

type SearchParams = {
  client?: string
  unit?: string
  status?: string
  from?: string
  to?: string
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { supabase } = await requireUser()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .order('name')

  let unitsQuery = supabase
    .from('units')
    .select('id, name, client_id')
    .order('name')
  if (params.client) unitsQuery = unitsQuery.eq('client_id', params.client)
  const { data: units } = await unitsQuery

  let allowedClosingIds: string[] | null = null
  if (params.unit) {
    const { data: unitItems } = await supabase
      .from('closing_items')
      .select('closing_id')
      .eq('unit_id', params.unit)

    allowedClosingIds = Array.from(
      new Set((unitItems ?? []).map((item: { closing_id: string }) => item.closing_id)),
    )
  }

  let query = supabase
    .from('closings')
    .select('*, clients(name)')
    .order('period_end', { ascending: false })
    .limit(100)

  if (params.client) query = query.eq('client_id', params.client)
  if (params.status && params.status !== 'all') query = query.eq('status', params.status)
  // Um fechamento entra no filtro quando seu período cruza o intervalo informado.
  if (params.from) query = query.gte('period_end', params.from)
  if (params.to) query = query.lte('period_start', params.to)
  if (allowedClosingIds) {
    query = query.in(
      'id',
      allowedClosingIds.length
        ? allowedClosingIds
        : ['00000000-0000-0000-0000-000000000000'],
    )
  }

  const { data: closings } = await query
  const detailQuery = params.unit ? `?unit=${encodeURIComponent(params.unit)}` : ''

  return (
    <>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">DOCUMENTOS</p>
          <h1>Relatórios financeiros</h1>
          <p className="muted">
            Os relatórios usam exatamente os itens congelados em cada fechamento.
          </p>
        </div>
      </header>

      <section className="panel">
        <form className="filters" method="get">
          <label>
            Cliente
            <select name="client" defaultValue={params.client ?? ''}>
              <option value="">Todos</option>
              {clients?.map((client: any) => (
                <option value={client.id} key={client.id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label>
            Unidade
            <select name="unit" defaultValue={params.unit ?? ''}>
              <option value="">Todas</option>
              {units?.map((unit: any) => (
                <option value={unit.id} key={unit.id}>{unit.name}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={params.status ?? 'all'}>
              <option value="all">Todos</option>
              <option value="open">Em aberto</option>
              <option value="approved">Aprovado</option>
              <option value="paid">Pago</option>
            </select>
          </label>
          <label>
            Período inicial
            <input type="date" name="from" defaultValue={params.from} />
          </label>
          <label>
            Período final
            <input type="date" name="to" defaultValue={params.to} />
          </label>
          <button className="button secondary">Filtrar</button>
          <Link className="button linkButton" href="/relatorios">Limpar</Link>
        </form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Relatórios disponíveis</h2>
          <span className="badge neutral">{closings?.length ?? 0}</span>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Período</th>
                <th>Receita</th>
                <th>Líquido</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {closings?.map((closing: any) => (
                <tr key={closing.id}>
                  <td>{closing.clients?.name}</td>
                  <td>{dateBR(closing.period_start)} → {dateBR(closing.period_end)}</td>
                  <td>{currency(closing.gross_revenue)}</td>
                  <td>{currency(closing.owner_net)}</td>
                  <td>
                    <span className={`badge ${closing.status === 'approved' || closing.status === 'paid' ? 'confirmed' : 'pending'}`}>
                      {closing.status}
                    </span>
                  </td>
                  <td>
                    <Link className="tableLink" href={`/relatorios/${closing.id}${detailQuery}`}>
                      Visualizar
                    </Link>
                  </td>
                </tr>
              ))}
              {!closings?.length && (
                <tr>
                  <td colSpan={6} className="empty">
                    Nenhum fechamento corresponde aos filtros informados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
