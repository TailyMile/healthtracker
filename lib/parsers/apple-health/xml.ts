import { XMLParser } from "fast-xml-parser";
import type { AppleHealthRecordLike } from "./normalize";

export interface AppleHealthXmlExport {
  records: AppleHealthRecordLike[];
  warnings: string[];
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function parseAppleHealthXml(xml: string): AppleHealthXmlExport {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    allowBooleanAttributes: true,
    trimValues: true
  });

  const parsed = parser.parse(xml) as Record<string, unknown>;
  const root = parsed.HealthData as Record<string, unknown> | undefined;
  const records = asArray(root?.Record as AppleHealthRecordLike | AppleHealthRecordLike[] | undefined);
  const warnings: string[] = [];

  if (!records.length) {
    warnings.push("No HealthData/Record nodes found in XML export.");
  }

  return { records, warnings };
}
