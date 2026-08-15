export function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export function optionalText(formData: FormData, key: string) {
  return text(formData, key) || null
}

export function numberValue(formData: FormData, key: string, fallback = 0) {
  const value = Number(formData.get(key) ?? fallback)
  return Number.isFinite(value) ? value : fallback
}

export function checkbox(formData: FormData, key: string) {
  return formData.get(key) === 'on' || formData.get(key) === 'true'
}
