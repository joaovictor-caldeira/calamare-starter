import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  approveClosingAction,
  markPayoutPaidAction,
  recalculateClosingAction,
  reopenClosingAction,
} from '@/actions/closings'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'
import { currency, dateBR, dateTimeBR } from '@/lib/format'
import { signedFileUrl } from '@/lib/storage'

const labels: Record<string, string> = {
  revenue: 'Receitas',
  platform_fee: 'Comissões dos canais',
  discount: 'Descontos',
  expense: 'Despesas descontáveis',
  management_fee: 'Comissão da JOCA',
  emergency_reserve: 'Reserva de emergência',
}

const statusLabels: Record<string, string> = {
  open: 'Em aberto',
  review: 'Em revisão',
  approved: 'Aprovado',
  payout_scheduled: 'Repasse agendado',
  paid: 'Repasse realizado',
}

export default async function ClosingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; sucesso?: string }>
}) {
  const { id } = await params
  const messages = await searchParams
  const { supabase, user } = await requireUser()

  const [
    { data: closing },
    { data: items },
    { data: payout },
    { data: versions },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('closings')
      .select('*, clients(name, email, phone, payout_day)')
      .eq('id', id)
      .single(),

    supabase
      .from('closing_items')
      .select('*, units(name)')
      .eq('closing_id', id)
      .order('occurred_on'),

    supabase
      .from('payouts')
      .select('*')
      .eq('closing_id', id)
      .maybeSingle(),

    supabase
      .from('closing_versions')
      .select(
        'id, version, archived_at, reopen_reason, closing_snapshot',
      )
      .eq('closing_id', id)
      .order('version', { ascending: false }),

    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ])

  if (!closing) {
    notFound()
  }

  const proofUrl = await signedFileUrl(
    supabase,
    payout?.proof_path,
  )

  const groups = Object.entries(labels).map(
    ([type, label]) => ({
      type,
      label,
      items: (items ?? []).filter(
        (item: any) => item.item_type === type,
      ),
    }),
  )

  const canReopen =
    profile?.role === 'superadmin' &&
    ['approved', 'payout_scheduled'].includes(closing.status) &&
    payout?.status !== 'paid'

  return (
    <>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">FECHAMENTO</p>
          <h1>{closing.clients?.name}</h1>
          <p className="muted">
            {dateBR(closing.period_start)} a{' '}
            {dateBR(closing.period_end)}
            {' · '}
            Versão {closing.version ?? 1}
          </p>
        </div>

        <div className="headerValue">
          <small>Líquido do proprietário</small>
          <strong>{currency(closing.owner_net)}</strong>
        </div>
      </header>

      <div className="actionRow noPrint">
        <Link
          className="button secondary"
          href="/fechamentos"
        >
          Voltar
        </Link>

        <Link
          className="button secondary"
          href={`/relatorios/${closing.id}`}
        >
          Abrir relatório
        </Link>
      </div>

      <Feedback
        erro={messages.erro}
        sucesso={messages.sucesso}
      />

      {closing.status === 'review' && (
        <section className="panel">
          <div className="panelHeader">
            <h2>Fechamento em revisão</h2>
            <span className="badge pending">Em revisão</span>
          </div>

          <p>
            Este fechamento foi reaberto para correção.
            Os números abaixo ainda representam o último cálculo.
          </p>

          <p>
            <strong>Motivo:</strong>{' '}
            {closing.reopen_reason ?? '—'}
          </p>

          <p className="muted">
            Corrija primeiro a receita, despesa ou lançamento
            necessário no módulo Financeiro. Depois volte a esta
            página e clique em “Recalcular fechamento”.
          </p>

          <form action={recalculateClosingAction}>
            <input
              type="hidden"
              name="id"
              value={closing.id}
            />

            <ConfirmButton
              label="Recalcular fechamento"
              confirmMessage="O sistema atualizará esta versão com os lançamentos atuais do período. Continuar?"
              className="button primary"
            />
          </form>
        </section>
      )}

      <section className="summaryGrid">
        <div>
          <small>Receita bruta</small>
          <strong>{currency(closing.gross_revenue)}</strong>
        </div>

        <div>
          <small>Taxas dos canais</small>
          <strong>{currency(closing.platform_fees)}</strong>
        </div>

        <div>
          <small>Descontos</small>
          <strong>{currency(closing.discounts)}</strong>
        </div>

        <div>
          <small>Despesas</small>
          <strong>{currency(closing.operating_expenses)}</strong>
        </div>

        <div>
          <small>Comissão JOCA</small>
          <strong>{currency(closing.management_fee)}</strong>
        </div>

        <div>
          <small>Reserva</small>
          <strong>{currency(closing.emergency_reserve)}</strong>
        </div>
      </section>

      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <section
              className="panel"
              key={group.type}
            >
              <div className="panelHeader">
                <h2>{group.label}</h2>
                <strong>
                  {currency(
                    group.items.reduce(
                      (sum: number, item: any) =>
                        sum + Number(item.amount),
                      0,
                    ),
                  )}
                </strong>
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Unidade</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                    </tr>
                  </thead>

                  <tbody>
                    {group.items.map((item: any) => (
                      <tr key={item.id}>
                        <td>{dateBR(item.occurred_on)}</td>
                        <td>{item.units?.name ?? '—'}</td>
                        <td>{item.description}</td>
                        <td>{currency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ),
      )}

      <section className="panel">
        <div className="panelHeader">
          <h2>Aprovação e repasse</h2>

          <span
            className={`badge ${
              closing.status === 'approved' ||
              closing.status === 'paid'
                ? 'confirmed'
                : 'pending'
            }`}
          >
            {statusLabels[closing.status] ?? closing.status}
          </span>
        </div>

        {closing.status === 'open' && (
          <form action={approveClosingAction}>
            <input
              type="hidden"
              name="id"
              value={closing.id}
            />

            <ConfirmButton
              label="Aprovar e bloquear fechamento"
              confirmMessage="Após a aprovação, os valores ficarão bloqueados. Se for necessário corrigir antes do repasse, somente o superadministrador poderá reabrir com justificativa. Continuar?"
              className="button primary"
            />
          </form>
        )}

        {closing.approved_at && (
          <p>
            Aprovado em {dateTimeBR(closing.approved_at)}.
          </p>
        )}

        {payout && closing.status !== 'review' && (
          <div className="summaryGrid topGap">
            <div>
              <small>Valor do repasse</small>
              <strong>{currency(payout.amount)}</strong>
            </div>

            <div>
              <small>Data agendada</small>
              <strong>{dateBR(payout.scheduled_date)}</strong>
            </div>

            <div>
              <small>Status</small>
              <span
                className={`badge ${
                  payout.status === 'paid'
                    ? 'confirmed'
                    : 'pending'
                }`}
              >
                {payout.status}
              </span>
            </div>
          </div>
        )}

        {canReopen && (
          <div className="topGap">
            <h3>Encontrou algo faltando?</h3>

            <p className="muted">
              Como o repasse ainda não foi realizado, o
              superadministrador pode reabrir este fechamento.
              A versão aprovada atual será preservada no histórico.
            </p>

            <form
              action={reopenClosingAction}
              className="formGrid compact"
            >
              <input
                type="hidden"
                name="id"
                value={closing.id}
              />

              <label>
                Motivo da reabertura*
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  placeholder="Ex.: Faltou lançar a lavanderia da unidade Coralli."
                />
              </label>

              <div className="formActions">
                <ConfirmButton
                  label="Reabrir para correção"
                  confirmMessage="A versão aprovada será arquivada e o repasse agendado será suspenso. Deseja reabrir?"
                  className="button danger"
                />
              </div>
            </form>
          </div>
        )}

        {closing.status === 'paid' && (
          <p className="muted topGap">
            Este fechamento possui repasse realizado e não pode
            ser reaberto. Uma diferença encontrada depois do
            pagamento deve ser lançada como ajuste no próximo ciclo.
          </p>
        )}

        {payout &&
          payout.status !== 'paid' &&
          closing.status === 'approved' && (
            <form
              action={markPayoutPaidAction}
              className="formGrid topGap"
              encType="multipart/form-data"
            >
              <input
                type="hidden"
                name="payout_id"
                value={payout.id}
              />

              <input
                type="hidden"
                name="closing_id"
                value={closing.id}
              />

              <label>
                Forma de pagamento
                <input
                  name="payment_method"
                  placeholder="PIX, TED..."
                />
              </label>

              <label>
                Comprovante
                <input
                  type="file"
                  name="proof"
                  accept="image/*,.pdf"
                />
              </label>

              <label>
                Observações
                <input name="notes" />
              </label>

              <div className="formActions">
                <ConfirmButton
                  label="Registrar repasse realizado"
                  confirmMessage="Confirma que o valor foi transferido ao proprietário?"
                  className="button primary"
                />
              </div>
            </form>
          )}

        {payout?.paid_at && (
          <p className="topGap">
            Repasse registrado em{' '}
            {dateTimeBR(payout.paid_at)}.{' '}
            {proofUrl && (
              <a
                className="tableLink"
                href={proofUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir comprovante
              </a>
            )}
          </p>
        )}
      </section>

      {(versions?.length ?? 0) > 0 && (
        <section className="panel">
          <div className="panelHeader">
            <h2>Histórico de versões aprovadas</h2>
            <span className="badge neutral">
              {versions?.length ?? 0}
            </span>
          </div>

          <p className="muted">
            Cada linha abaixo é uma fotografia imutável do
            fechamento que havia sido aprovado antes de uma
            reabertura.
          </p>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Arquivada em</th>
                  <th>Motivo da correção</th>
                  <th>Líquido anterior</th>
                </tr>
              </thead>

              <tbody>
                {versions?.map((revision: any) => (
                  <tr key={revision.id}>
                    <td>Versão {revision.version}</td>
                    <td>
                      {dateTimeBR(revision.archived_at)}
                    </td>
                    <td>{revision.reopen_reason}</td>
                    <td>
                      {currency(
                        revision.closing_snapshot?.owner_net ?? 0,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
