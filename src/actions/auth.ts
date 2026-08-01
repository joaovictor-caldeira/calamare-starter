'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()

  const password = String(formData.get('password') ?? '')

  console.log('[LOGIN] Tentativa de acesso:', {
    email,
    quantidadeCaracteresSenha: password.length,
  })

  if (!email || !password) {
    redirect('/login?erro=Informe+o+e-mail+e+a+senha')
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('[LOGIN] Erro devolvido pelo Supabase:', {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
    })

    const mensagem = [
      error.code ?? error.name ?? 'erro',
      error.message,
    ].join(': ')

    redirect(`/login?erro=${encodeURIComponent(mensagem)}`)
  }

  console.log('[LOGIN] Autenticação realizada:', {
    id: data.user?.id,
    email: data.user?.email,
  })

  redirect('/dashboard')
}

export async function logoutAction() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect('/login')
}