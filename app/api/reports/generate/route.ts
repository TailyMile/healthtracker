import { generateAndSaveReportBundle } from "@/lib/reports";
import type { ReportPreset, ReportRange } from "@/lib/domain/types";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";

export const runtime = "nodejs";

type GenerateBody = {
  preset?: ReportPreset;
  startDate?: string;
  endDate?: string;
};

function isDateInput(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function toUtcStart(dateInput: string) {
  return new Date(`${dateInput}T00:00:00.000Z`);
}

function toSelectedRange(body: GenerateBody): ReportRange {
  const allowedPresets: ReportPreset[] = ["day", "week", "month", "year", "custom"];
  const preset = allowedPresets.includes(body.preset as ReportPreset) ? (body.preset as ReportPreset) : "week";
  const now = new Date();
  const msInDay = 24 * 60 * 60 * 1000;

  if (preset === "custom" && isDateInput(body.startDate) && isDateInput(body.endDate)) {
    const start = toUtcStart(body.startDate);
    const endInclusive = toUtcStart(body.endDate);
    const endExclusive = new Date(endInclusive.getTime() + msInDay);
    if (start < endExclusive) {
      return {
        preset: "custom",
        start: start.toISOString(),
        end: endExclusive.toISOString(),
        label: `${body.startDate} - ${body.endDate}`
      };
    }
  }

  const presets: Record<Exclude<ReportPreset, "custom">, { days: number; label: string }> = {
    day: { days: 1, label: "последний день" },
    week: { days: 7, label: "последняя неделя" },
    month: { days: 30, label: "последний месяц" },
    year: { days: 365, label: "последний год" }
  };

  const fallbackPreset = preset === "custom" ? "week" : preset;
  const selected = presets[fallbackPreset];
  const end = now;
  const start = new Date(end.getTime() - selected.days * msInDay);

  return {
    preset: fallbackPreset,
    start: start.toISOString(),
    end: end.toISOString(),
    label: selected.label
  };
}

export async function POST(request: Request) {
  try {
    let body: GenerateBody = {};
    try {
      body = (await request.json()) as GenerateBody;
    } catch {
      body = {};
    }

    const selectedRange = toSelectedRange(body);
    const bundle = await generateAndSaveReportBundle({ selectedRange });
    return jsonOk(bundle);
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
