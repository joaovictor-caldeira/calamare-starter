import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const selectedUnitId = new URL(request.url).searchParams.get('unit')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [{ data: closing }, { data: allItems }] = await Promise.all([
    supabase.from('closings').select('*, clients(name)').eq('id', id).single(),
    supabase.from('closing_items').select('*, units(id, name)').eq('closing_id', id).order('occurred_on'),
  ])
  if (!closing) return NextResponse.json({ error: 'Fechamento não encontrado' }, { status: 404 })

  const items = selectedUnitId
    ? (allItems ?? []).filter((item: any) => item.unit_id === selectedUnitId)
    : (allItems ?? [])
  const selectedUnitName = selectedUnitId
    ? items.find((item: any) => item.units?.id === selectedUnitId)?.units?.name ?? 'Unidade'
    : null

  const sumType = (type: string) => items
    .filter((item: any) => item.item_type === type)
    .reduce((sum: number, item: any) => sum + Number(item.amount), 0)

  const gross = selectedUnitId ? sumType('revenue') : Number(closing.gross_revenue)
  const platform = selectedUnitId ? sumType('platform_fee') : Number(closing.platform_fees)
  const discounts = selectedUnitId ? sumType('discount') : Number(closing.discounts)
  const expenses = selectedUnitId ? sumType('expense') : Number(closing.operating_expenses)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'JOCA Gerenciamento Imobiliário'
  const summary = workbook.addWorksheet('Resumo')
  summary.columns = [{ width: 34 }, { width: 24 }]
  summary.addRows([
    ['Cliente', closing.clients?.name ?? ''],
    ['Visão', selectedUnitName ?? 'Consolidado do proprietário'],
    ['Período inicial', closing.period_start],
    ['Período final', closing.period_end],
    ['Receita bruta', gross],
    ['Comissões dos canais', platform],
    ['Descontos', discounts],
    ['Despesas', expenses],
    ...(selectedUnitId
      ? [['Resultado operacional', gross - platform - discounts - expenses]]
      : [
          ['Comissão JOCA', Number(closing.management_fee)],
          ['Reserva de emergência', Number(closing.emergency_reserve)],
          ['Líquido do proprietário', Number(closing.owner_net)],
        ]),
    ['Status', closing.status],
  ])
  summary.getColumn(2).numFmt = '#,##0.00'
  summary.getRow(1).font = { bold: true }

  const details = workbook.addWorksheet('Detalhamento')
  details.columns = [
    { header: 'Tipo', key: 'type', width: 24 },
    { header: 'Data', key: 'date', width: 14 },
    { header: 'Unidade', key: 'unit', width: 25 },
    { header: 'Descrição', key: 'description', width: 48 },
    { header: 'Valor', key: 'amount', width: 16 },
  ]
  for (const item of items) {
    details.addRow({
      type: item.item_type,
      date: item.occurred_on,
      unit: item.units?.name ?? '',
      description: item.description,
      amount: Number(item.amount),
    })
  }
  details.getRow(1).font = { bold: true }
  details.getColumn('amount').numFmt = '#,##0.00'

  const buffer = await workbook.xlsx.writeBuffer()
  const safeName = String(closing.clients?.name ?? 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
  const unitSuffix = selectedUnitName
    ? `-${selectedUnitName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`
    : ''

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="relatorio-${safeName}${unitSuffix}-${closing.period_end}.xlsx"`,
    },
  })
}
