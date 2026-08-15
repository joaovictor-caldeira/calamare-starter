'use client'

import { useRef, type MouseEvent } from 'react'

export function ConfirmButton({
  label,
  confirmMessage,
  className = 'button danger',
}: {
  label: string
  confirmMessage: string
  className?: string
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={buttonRef}
      type="submit"
      className={className}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (!window.confirm(confirmMessage)) event.preventDefault()
      }}
    >
      {label}
    </button>
  )
}
