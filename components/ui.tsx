import type { ReactNode } from "react";
import Link from "next/link";

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="animate-fade-in rounded-[2rem] border border-sky-100 bg-white/90 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.06)] sm:p-8">
      <div className="max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">
          {eyebrow}
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
          {description}
        </p>
      </div>
      {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}

export function SectionCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.05)] ${className}`}>
      {title ? <h2 className="text-lg font-semibold text-slate-950">{title}</h2> : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
      {hint ? <div className="mt-2 text-sm text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "sky" | "emerald" | "amber" }) {
  const toneClass = {
    slate: "bg-slate-100 text-slate-700",
    sky: "bg-sky-100 text-sky-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
  }[tone];

  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

export function Button({
  children,
  variant = "primary",
  href,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  href?: string;
  onClick?: () => void | Promise<void>;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base = "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  const styles = {
    primary: "bg-slate-950 text-white hover:bg-slate-800",
    secondary: "bg-sky-600 text-white hover:bg-sky-500",
    ghost: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  }[variant];

  if (href) {
    return (
      <Link href={href} className={`${base} ${styles} ${className}`}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = normalized.includes("ok") || normalized.includes("готов") || normalized.includes("усп")
    ? "emerald"
    : normalized.includes("warn") || normalized.includes("ожид")
      ? "amber"
      : "sky";

  return <Badge tone={tone}>{status}</Badge>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="text-base font-semibold text-slate-950">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{description}</div>
    </div>
  );
}
