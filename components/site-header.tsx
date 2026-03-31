import Link from "next/link";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/import", label: "Импорт" },
  { href: "/reports", label: "Отчёты" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-sky-100/80 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            HealthTracker MVP
          </div>
          <div className="mt-1 hidden text-sm text-slate-600 sm:block">
            Личная аналитика активности, веса и восстановления
          </div>
        </div>
        <nav className="flex w-full items-center gap-2 overflow-x-auto rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm sm:w-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900 hover:text-white sm:px-4"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
