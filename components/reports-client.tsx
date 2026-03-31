"use client";

import { useEffect, useState } from "react";
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
  };
  error?: string;
};

export function ReportsClient() {
  const [report, setReport] = useState<ReportState>({ ok: false, data: { latestMarkdown: "" } });
  const [status, setStatus] = useState("Отчёт не сгенерирован");
  const [busy, setBusy] = useState(false);

  async function loadLatest() {
    const res = await fetch("/api/reports/latest", { cache: "no-store" });
    const json = (await res.json()) as ReportState;
    if (json.ok) setReport(json);
  }

  useEffect(() => {
    loadLatest().catch(() => undefined);
  }, []);

  async function generate() {
    setBusy(true);
    setStatus("Генерирую отчёт...");
    try {
      const res = await fetch("/api/reports/generate", { method: "POST" });
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

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <SectionCard title="Генерация отчёта">
          <div className="flex flex-wrap gap-3">
            <Button onClick={generate} disabled={busy}>Сформировать отчёт</Button>
            <Button href="/api/reports/download?kind=latest&format=md" variant="ghost">Скачать .md</Button>
            <Button href="/api/reports/download?kind=latest&format=json" variant="ghost">Скачать .json</Button>
            <Button onClick={uploadToDrive} variant="secondary" disabled={busy}>Upload to Google Drive</Button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <StatusPill status={status} />
            {report.data?.generatedAt ? <span className="text-sm text-slate-500">Обновлено: {new Date(report.data.generatedAt).toLocaleString("ru-RU")}</span> : null}
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
