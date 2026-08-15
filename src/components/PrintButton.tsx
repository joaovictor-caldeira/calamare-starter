'use client'

export function PrintButton() {
  return (
    <button type="button" className="button secondary noPrint" onClick={() => window.print()}>
      Imprimir / salvar PDF
    </button>
  )
}
