import { loginAction } from '@/actions/auth'

export const metadata = { title: 'Entrar' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const params = await searchParams

  return (
    <main className="loginPage">
      <section className="loginCard">
        <div className="loginBrand"><span className="brandMark large">J</span></div>
        <p className="eyebrow">BEM-VINDO À</p>
        <h1>JOCA</h1>
        <p className="muted center">Gerenciamento imobiliário e administração de hospedagens</p>
        {params.erro && <div className="alert error">{params.erro}</div>}
        <form action={loginAction} className="formStack">
          <label>E-mail<input type="email" name="email" required placeholder="voce@empresa.com" /></label>
          <label>Senha<input type="password" name="password" required placeholder="••••••••" /></label>
          <button className="button primary full" type="submit">Entrar</button>
        </form>
      </section>
    </main>
  )
}
