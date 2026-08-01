import Link from 'next/link'
import { logoutAction } from '@/actions/auth'

const links = [
  ['Visão geral', '/dashboard', '⌂'],
  ['Calendário', '/calendario', '▦'],
  ['Reservas', '/reservas', '◫'],
  ['Clientes', '/clientes', '◎'],
  ['Imóveis e unidades', '/unidades', '⌂'],
  ['Financeiro', '/financeiro', 'R$'],
]

export function Sidebar({ name, role }: { name: string; role: string }) {
  return (
    <aside className="sidebar">
      <div>
        <div className="brand">
          <span className="brandMark">C</span>
          <div><strong>CALAMARE</strong><small>Gestão de hospedagens</small></div>
        </div>
        <nav className="nav">
          {links.map(([label, href, icon]) => (
            <Link href={href} key={href}><span>{icon}</span>{label}</Link>
          ))}
        </nav>
      </div>
      <div className="sidebarFooter">
        <div><strong>{name}</strong><small>{role.replaceAll('_', ' ')}</small></div>
        <form action={logoutAction}><button className="button ghost full">Sair</button></form>
      </div>
    </aside>
  )
}
