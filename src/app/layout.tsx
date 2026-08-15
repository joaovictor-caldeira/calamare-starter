import type { Metadata } from 'next'
import './globals.css'
import { PWARegister } from '@/components/PWARegister'

export const metadata: Metadata = {
  title: {
    default: 'JOCA Gerenciamento Imobiliário',
    template: '%s | JOCA',
  },
  description: 'Gestão profissional de imóveis, hospedagens, financeiro e operações.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}
