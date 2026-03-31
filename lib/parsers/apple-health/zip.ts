import JSZip from "jszip";
import { detectAppleHealthFileKind } from "./detect";
import { parseAppleHealthCsv } from "./csv";
import { parseAppleHealthJson } from "./json";
import { parseAppleHealthXml } from "./xml";
import type { AppleHealthRecordLike } from "./normalize";

export async function parseAppleHealthZip(bytes: ArrayBuffer): Promise<{ records: AppleHealthRecordLike[]; warnings: string[]; sourceKind: string }> {
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files).filter((entry) => !entry.dir);

  const prioritized = files.sort((left, right) => {
    const leftName = left.name.toLowerCase();
    const rightName = right.name.toLowerCase();
    const score = (name: string) => (name.endsWith("export.xml") ? 0 : name.endsWith(".xml") ? 1 : name.endsWith(".json") ? 2 : name.endsWith(".csv") ? 3 : 9);
    return score(leftName) - score(rightName);
  });

  for (const file of prioritized) {
    const kind = detectAppleHealthFileKind(file.name);
    const text = await file.async("string");

    if (kind === "xml") {
      const result = parseAppleHealthXml(text);
      if (result.records.length) {
        return { records: result.records, warnings: result.warnings, sourceKind: `zip:${file.name}` };
      }
    }

    if (kind === "json") {
      const result = parseAppleHealthJson(text);
      if (result.records.length) {
        return { records: result.records, warnings: result.warnings, sourceKind: `zip:${file.name}` };
      }
    }

    if (kind === "csv") {
      const result = parseAppleHealthCsv(text);
      if (result.records.length) {
        return { records: result.records, warnings: result.warnings, sourceKind: `zip:${file.name}` };
      }
    }
  }

  return {
    records: [],
    warnings: ["No supported Apple Health export file was found in the ZIP archive."],
    sourceKind: "zip"
  };
}
