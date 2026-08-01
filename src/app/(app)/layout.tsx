import { Sidebar } from '@/components/Sidebar'
import { requireUser } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="appShell">
      <Sidebar name={profile?.full_name || user.email || 'Usuário'} role={profile?.role || 'usuário'} />
      <main className="content">{children}</main>
    </div>
  )
}
