"use client";

export function ReportsPreview({ markdown }: { markdown: string }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 text-slate-100 shadow-xl">
      <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
        latest_chatgpt_report.md
      </div>
      <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap p-4 text-sm leading-6">
        {markdown || "Отчёт ещё не сгенерирован."}
      </pre>
    </div>
  );
}
