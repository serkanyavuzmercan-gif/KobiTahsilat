import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KobiTahsilat | Tahsilat Takip',
  description: 'Hidroteknik cari tahsilat takip programı',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
                  KobiTahsilat
                </p>
                <h1 className="text-lg font-semibold text-slate-900">Tahsilat Takip</h1>
              </div>
              <nav className="flex gap-3 text-sm">
                <a className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100" href="/">
                  Özet
                </a>
                <a
                  className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100"
                  href="/cariler"
                >
                  Cariler
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  )
}
