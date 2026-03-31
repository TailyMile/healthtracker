"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, EmptyState, SectionCard, StatCard, StatusPill } from "@/components/ui";

type Ride = {
  date: string;
  name: string;
  distanceKm: number;
  movingTimeMin: number;
  elevationM: number;
  avgHr?: number;
};

type Summary = {
  ok: boolean;
  data?: {
    workouts: number;
    totalDistanceKm: number;
    totalMovingHours: number;
    currentWeightKg?: number;
    latestRides: Ride[];
    lastUpdatedAt?: string;
  };
  error?: string;
};

const fallback = {
  workouts: 0,
  totalDistanceKm: 0,
  totalMovingHours: 0,
  currentWeightKg: 85,
  latestRides: [] as Ride[],
};

function formatTime(hours: number) {
  return `${hours.toFixed(1)} ч`;
}

export function DashboardClient() {
  const [state, setState] = useState<Summary>({ ok: false, data: fallback });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
        const json = (await res.json()) as Summary;
        if (!cancelled) {
          setState(json.ok ? json : { ok: false, data: fallback, error: json.error });
        }
      } catch {
        if (!cancelled) setState({ ok: false, data: fallback, error: "Не удалось загрузить сводку" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const data = state.data ?? fallback;
  const recent = useMemo(() => data.latestRides.slice(0, 8), [data.latestRides]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Тренировок" value={loading ? "—" : String(data.workouts)} hint="Синхронизировано из Strava" />
        <StatCard label="Объём" value={loading ? "—" : `${data.totalDistanceKm.toFixed(1)} км`} hint="Сумма по всем активностям" />
        <StatCard label="Время" value={loading ? "—" : formatTime(data.totalMovingHours)} hint="В движении" />
        <StatCard label="Вес" value={loading ? "—" : `${data.currentWeightKg?.toFixed(1) ?? "—"} кг`} hint="Последнее значение из Apple Health" />
      </div>

      <SectionCard title="Последние велозаезды">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="sky">Strava</Badge>
          <StatusPill status={state.ok ? "Сводка готова" : state.error ?? "Пока нет данных"} />
        </div>
        {recent.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {recent.map((ride) => (
                <article key={`${ride.date}-${ride.name}`} className="rounded-[1.1rem] border border-slate-200 bg-white p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {new Date(ride.date).toLocaleString("ru-RU")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{ride.name}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                    <div>{ride.distanceKm.toFixed(1)} км</div>
                    <div>{ride.movingTimeMin.toFixed(0)} мин</div>
                    <div>{ride.elevationM.toFixed(0)} м</div>
                    <div>{ride.avgHr ? `${ride.avgHr.toFixed(0)} bpm` : "—"}</div>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-hidden rounded-[1.25rem] border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Дата</th>
                  <th className="px-4 py-3 text-left font-medium">Активность</th>
                  <th className="px-4 py-3 text-left font-medium">Дистанция</th>
                  <th className="px-4 py-3 text-left font-medium">Время</th>
                  <th className="px-4 py-3 text-left font-medium">Набор</th>
                  <th className="px-4 py-3 text-left font-medium">Пульс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recent.map((ride) => (
                  <tr key={`${ride.date}-${ride.name}`}>
                    <td className="px-4 py-3 text-slate-600">{new Date(ride.date).toLocaleString("ru-RU")}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">{ride.name}</td>
                    <td className="px-4 py-3 text-slate-600">{ride.distanceKm.toFixed(1)} км</td>
                    <td className="px-4 py-3 text-slate-600">{ride.movingTimeMin.toFixed(0)} мин</td>
                    <td className="px-4 py-3 text-slate-600">{ride.elevationM.toFixed(0)} м</td>
                    <td className="px-4 py-3 text-slate-600">{ride.avgHr ? `${ride.avgHr.toFixed(0)} bpm` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <EmptyState
            title="Пока нет поездок"
            description="Сначала загрузите Apple Health export и подключите Strava, чтобы dashboard наполнился реальными данными."
          />
        )}
      </SectionCard>
    </div>
  );
}
