import Link from "next/link";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/import", label: "Импорт" },
  { href: "/reports", label: "Отчёты" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-sky-100/80 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            HealthTracker MVP
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Личная аналитика активности, веса и восстановления
          </div>
        </div>
        <nav className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
