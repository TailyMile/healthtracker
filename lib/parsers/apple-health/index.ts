import { detectAppleHealthFileKind } from "./detect";
import { normalizeAppleHealthRecord } from "./normalize";
import { parseAppleHealthCsv } from "./csv";
import { parseAppleHealthJson } from "./json";
import { parseAppleHealthXml } from "./xml";
import { parseAppleHealthZip } from "./zip";
import type { AppleHealthParseResult } from "./types";

function textFromBytes(bytes: ArrayBuffer) {
  return new TextDecoder("utf-8").decode(bytes);
}

export async function parseAppleHealthFile(bytes: ArrayBuffer, fileName = "export.xml", mimeType?: string): Promise<AppleHealthParseResult> {
  const kind = detectAppleHealthFileKind(fileName, mimeType);
  const recordsResult: {
    records: Array<{ type: string; value?: string; unit?: string; startDate?: string; endDate?: string; sourceName?: string; device?: string; metadata?: Record<string, unknown> }>;
    warnings: string[];
    sourceKind?: string;
  } = kind === "zip"
    ? await parseAppleHealthZip(bytes)
    : (() => {
        const text = textFromBytes(bytes);
        if (kind === "xml") {
          return parseAppleHealthXml(text);
        }
        if (kind === "csv") {
          return parseAppleHealthCsv(text);
        }
        return parseAppleHealthJson(text);
      })();

  const metrics = recordsResult.records.flatMap((record) => normalizeAppleHealthRecord(record));

  return {
    metrics,
    workouts: [],
    sourceKind: recordsResult.sourceKind ?? kind,
    warnings: recordsResult.warnings
  };
}

export { detectAppleHealthFileKind };
export { parseAppleDate, toIsoString } from "./date";
export { normalizeAppleHealthRecord } from "./normalize";
export { parseAppleHealthCsv } from "./csv";
export { parseAppleHealthJson } from "./json";
export { parseAppleHealthXml } from "./xml";
export { parseAppleHealthZip } from "./zip";
export type { AppleHealthParseResult } from "./types";
