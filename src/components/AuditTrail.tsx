import { dateTimeBR } from '@/lib/format'

function changedFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) {
  if (!oldData && newData) return ['Registro criado']
  if (oldData && !newData) return ['Registro excluído']
  const keys = new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])
  return [...keys]
    .filter((key) => JSON.stringify(oldData?.[key]) !== JSON.stringify(newData?.[key]))
    .filter((key) => !['updated_at', 'updated_by'].includes(key))
}

export function AuditTrail({ logs }: { logs: any[] }) {
  return (
    <section className="panel">
      <div className="panelHeader"><h2>Histórico de alterações</h2><span className="badge neutral">{logs.length}</span></div>
      <div className="timeline">
        {logs.map((log) => (
          <article className="timelineItem" key={log.id}>
            <div><strong>{String(log.action).toUpperCase()}</strong><small>{dateTimeBR(log.created_at)}</small></div>
            <p>{changedFields(log.old_data, log.new_data).join(', ') || 'Sem alteração relevante'}</p>
            <small className="muted">Usuário: {log.user_id ?? 'processo automático'}</small>
          </article>
        ))}
        {!logs.length && <p className="empty">Ainda não há alterações registradas.</p>}
      </div>
    </section>
  )
}
