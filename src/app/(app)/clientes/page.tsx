import { createClientAction } from '@/actions/clients'
import { Feedback } from '@/components/Feedback'
import { requireUser } from '@/lib/auth'

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const params = await searchParams
  const { supabase } = await requireUser()
  const { data: clients } = await supabase.from('clients').select('*').order('name')

  return (
    <>
      <header className="pageHeader"><div><p className="eyebrow">CADASTROS</p><h1>Clientes e proprietários</h1><p className="muted">Cada cliente pode possuir vários imóveis e unidades.</p></div></header>
      <Feedback erro={params.erro} sucesso={params.sucesso} />
      <section className="panel">
        <div className="panelHeader"><h2>Novo cliente</h2></div>
        <form action={createClientAction} className="formGrid">
          <label>Nome completo ou razão social*<input name="name" required /></label>
          <label>CPF ou CNPJ<input name="cpf_cnpj" /></label>
          <label>E-mail<input type="email" name="email" /></label>
          <label>Telefone<input name="phone" /></label>
          <label>Taxa de administração (%)<input type="number" step="0.01" name="management_fee" defaultValue="20" /></label>
          <label>Dia de fechamento<input type="number" min="1" max="28" name="closing_day" defaultValue="15" /></label>
          <label>Dia de repasse<input type="number" min="1" max="28" name="payout_day" defaultValue="20" /></label>
          <div className="formActions"><button className="button primary">Salvar cliente</button></div>
        </form>
      </section>
      <section className="panel">
        <div className="panelHeader"><h2>Clientes cadastrados</h2><span className="badge neutral">{clients?.length ?? 0}</span></div>
        <div className="tableWrap"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Taxa</th><th>Fechamento</th><th>Status</th></tr></thead>
          <tbody>{clients?.map((client: any) => <tr key={client.id}><td><strong>{client.name}</strong><small className="block muted">{client.cpf_cnpj || 'Sem documento'}</small></td><td>{client.email || client.phone || '—'}</td><td>{client.management_fee_value}%</td><td>Dia {client.closing_day}</td><td><span className="badge confirmed">{client.status}</span></td></tr>)}
          {!clients?.length && <tr><td colSpan={5} className="empty">Cadastre o primeiro cliente.</td></tr>}</tbody>
        </table></div>
      </section>
    </>
  )
}
