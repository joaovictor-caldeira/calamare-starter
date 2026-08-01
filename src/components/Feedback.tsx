export function Feedback({ erro, sucesso }: { erro?: string; sucesso?: string }) {
  if (!erro && !sucesso) return null
  return <div className={erro ? 'alert error' : 'alert success'}>{erro ?? sucesso}</div>
}
