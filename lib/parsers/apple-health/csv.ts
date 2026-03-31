import type { AppleHealthRecordLike } from "./normalize";

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseAppleHealthCsv(csv: string): { records: AppleHealthRecordLike[]; warnings: string[] } {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return { records: [], warnings: ["CSV export does not contain enough rows."] };
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const records: AppleHealthRecordLike[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    const recordType = String(row.type ?? row.Type ?? row.recordType ?? row.RecordType ?? "").trim();
    if (!recordType) {
      continue;
    }

    records.push({
      type: recordType,
      value: String(row.value ?? row.Value ?? row.quantity ?? row.Quantity ?? "").trim() || undefined,
      unit: String(row.unit ?? row.Unit ?? "").trim() || undefined,
      startDate: String(row.startDate ?? row.StartDate ?? row.start ?? "").trim() || undefined,
      endDate: String(row.endDate ?? row.EndDate ?? row.end ?? "").trim() || undefined,
      sourceName: String(row.sourceName ?? row.SourceName ?? "").trim() || undefined,
      device: String(row.device ?? row.Device ?? "").trim() || undefined
    });
  }

  return { records, warnings: [] };
}
