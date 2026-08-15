import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/PrintButton'
import { requireUser } from '@/lib/auth'
import { currency, dateBR } from '@/lib/format'

const order = [
  'revenue',
  'platform_fee',
  'discount',
  'expense',
  'management_fee',
  'emergency_reserve',
]

const labels: Record<string, string> = {
  revenue: 'Receitas',
  platform_fee: 'Comissões dos canais',
  discount: 'Descontos',
  expense: 'Despesas',
  management_fee: 'Comissão da administradora',
  emergency_reserve: 'Reserva de emergência',
}

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ unit?: string }>
}) {
  const { id } = await params
  const queryParams = await searchParams
  const { supabase } = await requireUser()

  const { data: closing } = await supabase
    .from('closings')
    .select('*, clients(name, cpf_cnpj, email, phone)')
    .eq('id', id)
    .single()

  if (!closing) notFound()

  const [{ data: allItems }, { data: units }] = await Promise.all([
    supabase
      .from('closing_items')
      .select('*, units(id, name)')
      .eq('closing_id', id)
      .order('occurred_on'),
    supabase
      .from('units')
      .select('id, name')
      .eq('client_id', closing.client_id)
      .order('name'),
  ])

  const selectedUnit = units?.find((unit: any) => unit.id === queryParams.unit)
  const items = selectedUnit
    ? (allItems ?? []).filter((item: any) => item.unit_id === selectedUnit.id)
    : (allItems ?? [])

  const sumType = (type: string) => items
    .filter((item: any) => item.item_type === type)
    .reduce((sum: number, item: any) => sum + Number(item.amount), 0)

  const gross = selectedUnit ? sumType('revenue') : Number(closing.gross_revenue)
  const platform = selectedUnit ? sumType('platform_fee') : Number(closing.platform_fees)
  const discounts = selectedUnit ? sumType('discount') : Number(closing.discounts)
  const expenses = selectedUnit ? sumType('expense') : Number(closing.operating_expenses)
  const operationalNet = gross - platform - discounts - expenses
  const excelQuery = selectedUnit ? `?unit=${encodeURIComponent(selectedUnit.id)}` : ''

  return (
    <article className="reportDocument">
      <div className="reportActions noPrint">
        <Link className="button secondary" href="/relatorios">Voltar</Link>
        <form method="get" className="inlineForm">
          <label>
            Visão
            <select name="unit" defaultValue={selectedUnit?.id ?? ''}>
              <option value="">Consolidado do proprietário</option>
              {units?.map((unit: any) => (
                <option value={unit.id} key={unit.id}>{unit.name}</option>
              ))}
            </select>
          </label>
          <button className="button secondary">Aplicar</button>
        </form>
        <PrintButton />
        <a className="button primary" href={`/api/relatorios/${id}/excel${excelQuery}`}>
          Baixar Excel
        </a>
      </div>

      <header className="reportHeader">
        <div>
          <p className="eyebrow">JOCA GERENCIAMENTO IMOBILIÁRIO</p>
          <h1>{selectedUnit ? 'Resumo por unidade' : 'Relatório financeiro consolidado'}</h1>
          <p>{closing.clients?.name}</p>
          {selectedUnit && <p><strong>Unidade:</strong> {selectedUnit.name}</p>}
        </div>
        <div>
          <strong>{dateBR(closing.period_start)} a {dateBR(closing.period_end)}</strong>
          <span className={`badge ${closing.status === 'approved' || closing.status === 'paid' ? 'confirmed' : 'pending'}`}>
            {closing.status}
          </span>
        </div>
      </header>

      <section className="summaryGrid reportSummary">
        <div><small>Receita bruta</small><strong>{currency(gross)}</strong></div>
        <div><small>Taxas dos canais</small><strong>{currency(platform)}</strong></div>
        <div><small>Descontos</small><strong>{currency(discounts)}</strong></div>
        <div><small>Despesas</small><strong>{currency(expenses)}</strong></div>
        {selectedUnit ? (
          <div><small>Resultado operacional da unidade</small><strong>{currency(operationalNet)}</strong></div>
        ) : (
          <>
            <div><small>Comissão JOCA</small><strong>{currency(closing.management_fee)}</strong></div>
            <div><small>Reserva de emergência</small><strong>{currency(closing.emergency_reserve)}</strong></div>
            <div><small>Líquido do proprietário</small><strong>{currency(closing.owner_net)}</strong></div>
          </>
        )}
      </section>

      {selectedUnit && (
        <p className="notice">
          A visão por unidade mostra o resultado operacional dos itens vinculados à unidade.
          Comissão da JOCA e reserva de emergência permanecem no consolidado, pois são valores do fechamento do proprietário e não são rateados automaticamente.
        </p>
      )}

      {order.map((type) => {
        const group = items.filter((item: any) => item.item_type === type)
        if (!group.length) return null
        return (
          <section className="reportSection" key={type}>
            <div className="panelHeader">
              <h2>{labels[type]}</h2>
              <strong>{currency(group.reduce((sum: number, item: any) => sum + Number(item.amount), 0))}</strong>
            </div>
            <table>
              <thead><tr><th>Data</th><th>Unidade</th><th>Descrição</th><th>Valor</th></tr></thead>
              <tbody>
                {group.map((item: any) => (
                  <tr key={item.id}>
                    <td>{dateBR(item.occurred_on)}</td>
                    <td>{item.units?.name ?? '—'}</td>
                    <td>{item.description}</td>
                    <td>{currency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}

      <footer className="reportFooter">
        <p>Relatório gerado a partir dos itens registrados no fechamento financeiro do sistema JOCA.</p>
        <p>Os valores de um fechamento aprovado permanecem bloqueados para preservar a prestação de contas.</p>
      </footer>
    </article>
  )
}
