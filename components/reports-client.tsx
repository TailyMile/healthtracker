"use client";

import { useEffect, useState } from "react";
import type { ReportPreset } from "@/lib/domain/types";
import { Button, SectionCard, StatusPill } from "@/components/ui";
import { ReportsPreview } from "@/components/reports-preview";

type ReportState = {
  ok: boolean;
  data?: {
    latestMarkdown: string;
    generatedAt?: string;
    daily?: unknown;
    weekly?: unknown;
    monthly?: unknown;
    selected?: unknown;
    selectedRange?: {
      preset: ReportPreset;
      start: string;
      end: string;
      label: string;
    };
  };
  error?: string;
};

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function presetRange(preset: Exclude<ReportPreset, "custom">) {
  const now = new Date();
  const days = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
  }[preset];
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { startDate: toDateInput(start), endDate: toDateInput(now) };
}

export function ReportsClient() {
  const [report, setReport] = useState<ReportState>({ ok: false, data: { latestMarkdown: "" } });
  const [status, setStatus] = useState("Отчёт не сгенерирован");
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<ReportPreset>("week");
  const [startDate, setStartDate] = useState(presetRange("week").startDate);
  const [endDate, setEndDate] = useState(presetRange("week").endDate);

  async function loadLatest() {
    const res = await fetch("/api/reports/latest", { cache: "no-store" });
    const json = (await res.json()) as ReportState;
    if (json.ok) {
      setReport(json);
      if (json.data?.selectedRange) {
        setPreset(json.data.selectedRange.preset);
        setStartDate(json.data.selectedRange.start.slice(0, 10));
        if (json.data.selectedRange.preset === "custom") {
          const endInclusive = new Date(new Date(json.data.selectedRange.end).getTime() - 24 * 60 * 60 * 1000);
          setEndDate(toDateInput(endInclusive));
        } else {
          setEndDate(json.data.selectedRange.end.slice(0, 10));
        }
      }
    }
  }

  useEffect(() => {
    loadLatest().catch(() => undefined);
  }, []);

  async function generate() {
    setBusy(true);
    setStatus("Генерирую отчёт...");
    try {
      const payload = {
        preset,
        startDate,
        endDate,
      };
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "generate failed");
      setStatus("Отчёт готов");
      await loadLatest();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка генерации");
    } finally {
      setBusy(false);
    }
  }

  async function uploadToDrive() {
    setBusy(true);
    setStatus("Загружаю в Google Drive...");
    try {
      const res = await fetch("/api/drive/upload-latest", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "upload failed");
      setStatus("Отчёт загружен в Google Drive");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка загрузки в Drive");
    } finally {
      setBusy(false);
    }
  }

  const markdown = report.data?.latestMarkdown ?? "";
  const selectedLabel = report.data?.selectedRange?.label;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <SectionCard title="Генерация отчёта">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["day", "week", "month", "year"] as const).map((option) => (
                <Button
                  key={option}
                  variant={preset === option ? "primary" : "ghost"}
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setPreset(option);
                    const range = presetRange(option);
                    setStartDate(range.startDate);
                    setEndDate(range.endDate);
                  }}
                  disabled={busy}
                >
                  {{
                    day: "День",
                    week: "Неделя",
                    month: "Месяц",
                    year: "Год"
                  }[option]}
                </Button>
              ))}
              <Button
                variant={preset === "custom" ? "primary" : "ghost"}
                className="w-full sm:w-auto"
                onClick={() => setPreset("custom")}
                disabled={busy}
              >
                Свой диапазон
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-600">
                Начало периода
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setPreset("custom");
                    setStartDate(event.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                />
              </label>
              <label className="text-sm text-slate-600">
                Конец периода
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => {
                    setPreset("custom");
                    setEndDate(event.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={generate} disabled={busy} className="w-full sm:w-auto">Сформировать отчёт</Button>
            <Button href="/api/reports/download?kind=latest&format=md" variant="ghost" className="w-full sm:w-auto">Скачать .md</Button>
            <Button href="/api/reports/download?kind=latest&format=json" variant="ghost" className="w-full sm:w-auto">Скачать .json</Button>
            <Button onClick={uploadToDrive} variant="secondary" disabled={busy} className="w-full sm:w-auto">Upload to Google Drive</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusPill status={status} />
            {report.data?.generatedAt ? <span className="text-sm text-slate-500">Обновлено: {new Date(report.data.generatedAt).toLocaleString("ru-RU")}</span> : null}
            {selectedLabel ? <span className="text-sm text-slate-500">Период: {selectedLabel}</span> : null}
          </div>
        </SectionCard>

        <SectionCard title="Markdown отчёт">
          <ReportsPreview markdown={markdown} />
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="Структура отчётов">
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>В MVP генерируются:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li><code>daily_summary.json</code></li>
              <li><code>weekly_summary.json</code></li>
              <li><code>monthly_summary.json</code></li>
              <li><code>latest_chatgpt_report.md</code></li>
            </ul>
            <p>В конце markdown добавляется JSON-блок с метаданными и ключевыми метриками, чтобы отчёт было удобно передавать в ChatGPT.</p>
          </div>
        </SectionCard>

        <SectionCard title="Флаги">
          <div className="space-y-3">
            {[
              "overload",
              "underload",
              "recovery_risk",
            ].map((flag) => (
              <div key={flag} className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-950">{flag}</span> — вычисляется на основе объёма, сна, resting HR и веса.
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
