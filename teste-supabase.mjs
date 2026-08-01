import fs from 'node:fs'

function carregarEnv() {
  const conteudo = fs.readFileSync('.env.local', 'utf8')

  return Object.fromEntries(
    conteudo
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter((linha) => linha && !linha.startsWith('#'))
      .map((linha) => {
        const posicao = linha.indexOf('=')

        return [
          linha.slice(0, posicao).trim(),
          linha.slice(posicao + 1).trim(),
        ]
      }),
  )
}

const env = carregarEnv()

const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

console.log('URL encontrada:', url)
console.log('Chave encontrada:', key ? 'SIM' : 'NÃO')
console.log(
  'Tipo da chave:',
  key?.startsWith('sb_publishable_')
    ? 'Publishable key'
    : 'Formato inesperado',
)

if (!url || !key) {
  console.error('URL ou chave não foram encontradas no .env.local')
  process.exit(1)
}

const enderecoTeste = `${url}/auth/v1/health`

console.log('Testando:', enderecoTeste)

try {
  const resposta = await fetch(enderecoTeste, {
    headers: {
      apikey: key,
    },
  })

  const texto = await resposta.text()

  console.log('Status HTTP:', resposta.status)
  console.log('Resposta:', texto)
} catch (erro) {
  console.error('A CONEXÃO FALHOU')
  console.error('Nome:', erro.name)
  console.error('Mensagem:', erro.message)
  console.error('Causa completa:', erro.cause)
}