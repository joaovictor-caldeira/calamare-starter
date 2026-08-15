export const PAGE_SIZE = 10

export function positiveInteger(value: string | undefined, fallback = 1) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function pageRange(page: number, pageSize = PAGE_SIZE) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

export function totalPages(count: number, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil(count / pageSize))
}
