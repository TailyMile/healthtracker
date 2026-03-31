import type { AppleHealthRecordLike } from "./normalize";

function collectRecords(value: unknown, output: AppleHealthRecordLike[]) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectRecords(item, output);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const type = record.type ?? record.recordType ?? record.identifier;
  if (typeof type === "string") {
    output.push({
      type,
      value: typeof record.value === "string" || typeof record.value === "number" ? String(record.value) : undefined,
      unit: typeof record.unit === "string" ? record.unit : undefined,
      startDate: typeof record.startDate === "string" ? record.startDate : typeof record.start === "string" ? record.start : undefined,
      endDate: typeof record.endDate === "string" ? record.endDate : typeof record.end === "string" ? record.end : undefined,
      sourceName: typeof record.sourceName === "string" ? record.sourceName : undefined,
      device: typeof record.device === "string" ? record.device : undefined,
      metadata: record.metadata && typeof record.metadata === "object" ? (record.metadata as Record<string, unknown>) : undefined
    });
  }

  for (const nested of Object.values(record)) {
    collectRecords(nested, output);
  }
}

export function parseAppleHealthJson(jsonText: string): { records: AppleHealthRecordLike[]; warnings: string[] } {
  const parsed = JSON.parse(jsonText) as unknown;
  const records: AppleHealthRecordLike[] = [];
  collectRecords(parsed, records);

  if (!records.length) {
    return { records: [], warnings: ["JSON export does not contain recognizable health records."] };
  }

  return { records, warnings: [] };
}
