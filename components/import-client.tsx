"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, SectionCard, StatusPill, EmptyState } from "@/components/ui";

type ImportStatus = {
  ok: boolean;
  data?: {
    strava: {
      connected: boolean;
      workouts: number;
      lastSyncAt?: string | null;
    };
    drive: {
      connected: boolean;
    };
    appleHealth: {
      metrics: number;
      latestMetricAt?: string;
      types: Array<{ type: string; count: number }>;
    };
    recommendation: {
      needsStrava: boolean;
      needsAppleHealth: boolean;
      verdict: string;
      details: string;
    };
  };
  error?: string;
};

export function ImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Готов к импорту");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [connections, setConnections] = useState<ImportStatus["data"]>();

  const canSubmit = useMemo(() => !!file && !busy, [file, busy]);
  const stravaConnected = Boolean(connections?.strava.connected);
  const driveConnected = Boolean(connections?.drive.connected);

  async function loadConnections() {
    const res = await fetch("/api/import/status", { cache: "no-store" });
    const json = (await res.json()) as ImportStatus;
    if (json.ok) {
      setConnections(json.data);
    }
  }

  useEffect(() => {
    loadConnections().catch(() => undefined);
  }, []);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setStatus("Импортирую Apple Health...");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/health/import", { method: "POST", body: form });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "import failed");
      setResult({ imported: json.data.imported ?? 0 });
      setStatus(`Импорт завершён: ${json.data.imported ?? 0} записей`);
      await loadConnections();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка импорта");
    } finally {
      setBusy(false);
    }
  }

  async function syncStrava() {
    if (!stravaConnected) {
      setStatus("Сначала подключите Strava");
      return;
    }
    setBusy(true);
    setStatus("Синхронизация Strava...");
    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "sync failed");
      setStatus(`Strava синхронизирован: ${json.data.imported ?? 0} активностей`);
      await loadConnections();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Strava sync error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Загрузить Apple Health export">
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-sky-400 hover:bg-sky-50/60">
            <input
              type="file"
              accept=".xml,.csv,.json,.zip"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <span className="text-base font-semibold text-slate-950">{file ? file.name : "Выберите Apple Health XML/CSV/JSON/ZIP"}</span>
            <span className="mt-2 text-sm text-slate-500">Можно загрузить export из Health на iPhone или архив с export.xml</span>
          </label>

          <div className="flex flex-wrap gap-3">
            <Button onClick={upload} disabled={!canSubmit} className="w-full sm:w-auto">Импортировать</Button>
            <Button variant="secondary" onClick={syncStrava} disabled={busy || !stravaConnected} className="w-full sm:w-auto">
              Sync Strava
            </Button>
            {stravaConnected ? (
              <Button variant="ghost" disabled className="w-full sm:w-auto">Strava подключен</Button>
            ) : (
              <Button href="/api/strava/connect" variant="ghost" className="w-full sm:w-auto">Подключить Strava</Button>
            )}
            {driveConnected ? (
              <Button variant="ghost" disabled className="w-full sm:w-auto">Google Drive подключен</Button>
            ) : (
              <Button href="/api/drive/connect" variant="ghost" className="w-full sm:w-auto">Подключить Google Drive</Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={status} />
            {result ? <span className="text-sm text-slate-600">Импортировано: {result.imported}</span> : null}
            {connections ? <StatusPill status={stravaConnected ? "Strava: подключен" : "Strava: не подключен"} /> : null}
            {connections ? <StatusPill status={driveConnected ? "Drive: подключен" : "Drive: не подключен"} /> : null}
          </div>
        </div>
      </SectionCard>

      {connections ? (
        <SectionCard title="Проверка достаточности данных">
          <div className="space-y-4">
            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-950">{connections.recommendation.verdict}</div>
              <div className="mt-1 text-sm text-slate-600">{connections.recommendation.details}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 text-sm">
                <div className="font-semibold text-slate-950">Strava</div>
                <div className="mt-1 text-slate-600">{stravaConnected ? "Подключен" : "Не подключен"}</div>
                <div className="mt-1 text-slate-600">Тренировок: {connections.strava.workouts}</div>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 text-sm">
                <div className="font-semibold text-slate-950">Apple Health</div>
                <div className="mt-1 text-slate-600">Метрик: {connections.appleHealth.metrics}</div>
                <div className="mt-1 text-slate-600">
                  Последняя: {connections.appleHealth.latestMetricAt ? new Date(connections.appleHealth.latestMetricAt).toLocaleString("ru-RU") : "—"}
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 text-sm">
                <div className="font-semibold text-slate-950">Google Drive</div>
                <div className="mt-1 text-slate-600">{driveConnected ? "Подключен" : "Не подключен"}</div>
                <div className="mt-1 text-slate-600">Для отчётов (опционально)</div>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Что поддерживается">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Вес", "body weight, кг"],
            ["Body fat", "% жира"],
            ["Пульс", "heart rate и resting HR"],
            ["Шаги", "steps"],
            ["Сон", "sleep minutes"],
            ["Калории", "active + resting energy"],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
              <div className="font-semibold text-slate-950">{title}</div>
              <div className="mt-1 text-sm text-slate-600">{desc}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Подсказка">
        <EmptyState
          title="Нужны сначала данные"
          description="После импорта Apple Health и синхронизации Strava dashboard и отчёты начнут показывать фактическую нагрузку и восстановление."
        />
      </SectionCard>
    </div>
  );
}
