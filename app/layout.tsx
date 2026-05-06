import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dra. Natalia Hebe Volpe — Psiquiatría',
  description: 'Turnos online para la consulta de la Dra. Natalia Hebe Volpe, Médica Psiquiatra.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dra. Volpe',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#06b6d4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
