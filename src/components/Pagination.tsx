import Link from 'next/link'

function buildHref(basePath: string, searchParams: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== 'page') params.set(key, value)
  }
  params.set('page', String(page))
  return `${basePath}?${params.toString()}`
}

export function Pagination({
  basePath,
  page,
  totalPages,
  searchParams,
}: {
  basePath: string
  page: number
  totalPages: number
  searchParams: Record<string, string | undefined>
}) {
  if (totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="Paginação">
      <Link
        className={`button secondary ${page <= 1 ? 'disabled' : ''}`}
        aria-disabled={page <= 1}
        href={page <= 1 ? '#' : buildHref(basePath, searchParams, page - 1)}
      >
        Anterior
      </Link>
      <span>Página {page} de {totalPages}</span>
      <Link
        className={`button secondary ${page >= totalPages ? 'disabled' : ''}`}
        aria-disabled={page >= totalPages}
        href={page >= totalPages ? '#' : buildHref(basePath, searchParams, page + 1)}
      >
        Próxima
      </Link>
    </nav>
  )
}
