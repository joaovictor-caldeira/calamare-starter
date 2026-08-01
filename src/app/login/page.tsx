import { loginAction } from '@/actions/auth'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const params = await searchParams

  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="loginBrand"><span className="brandMark large">C</span></div>
        <p className="eyebrow">BEM-VINDO À</p>
        <h1>CALAMARE</h1>
        <p className="muted center">Administração inteligente de hospedagens</p>
        {params.erro && <div className="alert error">{params.erro}</div>}
        <form action={loginAction} className="formStack">
          <label>E-mail<input type="email" name="email" required placeholder="voce@empresa.com" /></label>
          <label>Senha<input type="password" name="password" required placeholder="••••••••" /></label>
          <button className="button primary full" type="submit">Entrar</button>
        </form>
        <small className="muted center block">O primeiro usuário é criado no painel do Supabase.</small>
      </section>
    </main>
  )
}
