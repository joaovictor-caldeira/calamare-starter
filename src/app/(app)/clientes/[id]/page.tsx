import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteEmptyClientAction, setClientStatusAction, updateClientAction } from '@/actions/clients'
import { AuditTrail } from '@/components/AuditTrail'
import { ConfirmButton } from '@/components/ConfirmButton'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; sucesso?: string }>
}) {
  const { id } = await params
  const messages = await searchParams
  const { supabase } = await requireUser()

  const [{ data: client }, { data: properties }, { data: logs }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('properties').select('id, name, city, state, status, units(id, name, status)').eq('client_id', id).order('name'),
    supabase.from('audit_logs').select('*').eq('table_name', 'clients').eq('record_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  if (!client) notFound()

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">CLIENTE</p><h1>{client.name}</h1><p className="muted">Dados contratuais, imóveis e histórico.</p></div><Link className="button secondary" href="/clientes">Voltar</Link></header>
      <Feedback erro={messages.erro} sucesso={messages.sucesso} />

      <section className="panel">
        <div className="panelHeader"><h2>Editar cliente</h2><span className={`badge ${client.status === 'active' ? 'confirmed' : 'cancelled'}`}>{client.status}</span></div>
        <form action={updateClientAction} className="formGrid">
          <input type="hidden" name="id" value={client.id} />
          <label>Nome*<input name="name" required defaultValue={client.name} /></label>
          <label>CPF/CNPJ<input name="cpf_cnpj" defaultValue={client.cpf_cnpj ?? ''} /></label>
          <label>E-mail<input type="email" name="email" defaultValue={client.email ?? ''} /></label>
          <label>Telefone<input name="phone" defaultValue={client.phone ?? ''} /></label>
          <label>Endereço<input name="address" defaultValue={client.address ?? ''} /></label>
          <label>Dados bancários<textarea name="bank_details" rows={3} defaultValue={client.bank_details ?? ''} /></label>
          <label>Modelo da comissão<select name="management_fee_type" defaultValue={client.management_fee_type}><option value="percentage">Percentual</option><option value="fixed">Valor fixo</option></select></label>
          <label>Comissão<input type="number" step="0.01" min="0" name="management_fee" defaultValue={client.management_fee_value} /></label>
          <label>Base da comissão<select name="management_fee_base" defaultValue={client.management_fee_base ?? 'net_channels'}><option value="net_channels">Após taxas dos canais</option><option value="gross">Receita bruta</option></select></label>
          <label>Reserva de emergência<input type="number" step="0.01" min="0" name="emergency_reserve_default" defaultValue={client.emergency_reserve_default ?? 0} /></label>
          <label>Dia de fechamento<input type="number" min="1" max="28" name="closing_day" defaultValue={client.closing_day} /></label>
          <label>Dia de repasse<input type="number" min="1" max="28" name="payout_day" defaultValue={client.payout_day} /></label>
          <label className="span2">Observações<textarea name="notes" rows={4} defaultValue={client.notes ?? ''} /></label>
          <div className="formActions"><button className="button primary">Salvar alterações</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panelHeader"><h2>Imóveis vinculados</h2><span className="badge neutral">{properties?.length ?? 0}</span></div>
        <div className="cardList">
          {properties?.map((property: any) => (
            <article className="miniCard" key={property.id}>
              <div><strong>{property.name}</strong><small>{property.city ?? '—'}/{property.state ?? '—'}</small></div>
              <span>{property.units?.length ?? 0} unidade(s)</span>
              <Link className="tableLink" href={`/imoveis/${property.id}`}>Abrir imóvel</Link>
            </article>
          ))}
          {!properties?.length && <p className="empty">Nenhum imóvel cadastrado para este cliente.</p>}
        </div>
      </section>

      <section className="panel dangerZone">
        <div><h2>Estado do cadastro</h2><p className="muted">Inative para preservar todo o histórico. Exclua apenas cadastros vazios criados por engano.</p></div>
        <div className="actionRow">
          <form action={setClientStatusAction}>
            <input type="hidden" name="id" value={client.id} />
            <input type="hidden" name="status" value={client.status === 'active' ? 'inactive' : 'active'} />
            <ConfirmButton label={client.status === 'active' ? 'Inativar cliente' : 'Reativar cliente'} confirmMessage="Confirma a alteração de status deste cliente?" className="button secondary" />
          </form>
          <form action={deleteEmptyClientAction}>
            <input type="hidden" name="id" value={client.id} />
            <ConfirmButton label="Excluir cadastro vazio" confirmMessage="Esta exclusão é permanente e só funcionará se não houver dados vinculados. Continuar?" />
          </form>
        </div>
      </section>

      <AuditTrail logs={logs ?? []} />
    </>
  )
}
