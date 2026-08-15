import fs from 'node:fs'

const file = '.env.local'
if (!fs.existsSync(file)) {
  console.error('ERRO: .env.local não encontrado na raiz do projeto.')
  process.exit(1)
}

const values = Object.fromEntries(
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const position = line.indexOf('=')
      return [line.slice(0, position).trim(), line.slice(position + 1).trim()]
    }),
)

const url = values.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
const key = values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url) {
  console.error('ERRO: NEXT_PUBLIC_SUPABASE_URL não foi encontrada.')
  process.exit(1)
}
if (url.includes('/rest/v1')) {
  console.error('ERRO: use somente a URL-base do Supabase, sem /rest/v1/.')
  process.exit(1)
}
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)) {
  console.error('ERRO: formato inesperado para NEXT_PUBLIC_SUPABASE_URL:', url)
  process.exit(1)
}
if (!key?.startsWith('sb_publishable_')) {
  console.error('ERRO: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY está ausente ou não começa com sb_publishable_.')
  process.exit(1)
}

console.log('URL: OK')
console.log('Publishable key: OK')
console.log('Projeto:', url.replace('https://', '').replace('.supabase.co', ''))

try {
  const response = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: key },
  })
  const body = await response.text()
  console.log('Conexão com Supabase:', response.status, response.ok ? 'OK' : 'FALHOU')
  if (!response.ok) console.log('Resposta:', body.slice(0, 300))
  process.exit(response.ok ? 0 : 1)
} catch (error) {
  console.error('ERRO DE CONEXÃO:', error.message)
  if (error.cause) console.error('Causa:', error.cause)
  process.exit(1)
}
