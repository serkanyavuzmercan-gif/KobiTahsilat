export function AppFooter({ minimal = false }: { minimal?: boolean }) {
  const year = new Date().getFullYear()

  if (minimal) {
    return (
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        © {year} Hidroteknik A.Ş. · Tüm hakları saklıdır.
      </footer>
    )
  }

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-slate-700">KobiTahsilat</p>
          <p className="mt-0.5">Hidroteknik A.Ş. tahsilat takip platformu</p>
        </div>
        <div className="sm:text-right">
          <p>© {year} Hidroteknik A.Ş. Tüm hakları saklıdır.</p>
          <p className="mt-0.5 text-slate-400">Denizli, Türkiye</p>
        </div>
      </div>
    </footer>
  )
}
