import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hidroteknik Mutabakat ve Tahsilat Sistemi',
  description: 'Hidroteknik cari hesap mutabakatı ve tahsilat takip sistemi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
