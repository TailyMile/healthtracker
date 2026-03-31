import { beforeAll, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  detectAppleHealthFileKind,
  normalizeAppleHealthRecord,
  parseAppleDate,
  parseAppleHealthFile,
  parseAppleHealthXml,
  parseAppleHealthCsv,
  parseAppleHealthJson
} from "../lib/parsers/apple-health";

async function readFixture(name: string) {
  return readFile(join(process.cwd(), "tests/fixtures", name), "utf-8");
}

describe("apple health parser", () => {
  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  it("parses Apple date strings", () => {
    expect(parseAppleDate("2026-03-01 08:00:00 +0300").toISOString()).toBe("2026-03-01T05:00:00.000Z");
    expect(parseAppleDate("2026-03-01T08:00:00Z").toISOString()).toBe("2026-03-01T08:00:00.000Z");
  });

  it("detects file kinds", () => {
    expect(detectAppleHealthFileKind("export.xml")).toBe("xml");
    expect(detectAppleHealthFileKind("export.csv", "text/csv")).toBe("csv");
    expect(detectAppleHealthFileKind("export.json")).toBe("json");
    expect(detectAppleHealthFileKind("archive.zip")).toBe("zip");
  });

  it("parses XML export and normalizes records", async () => {
    const xml = await readFixture("apple-health-export.xml");
    const parsed = parseAppleHealthXml(xml);

    expect(parsed.records).toHaveLength(7);
    const metrics = parsed.records.flatMap((record) => normalizeAppleHealthRecord(record));
    expect(metrics.map((metric) => metric.type)).toEqual([
      "weight",
      "body_fat_pct",
      "heart_rate",
      "resting_hr",
      "steps",
      "sleep_minutes",
      "calories"
    ]);
    expect(metrics[0]?.value).toBeCloseTo(85.2, 3);
    expect(metrics[5]?.value).toBeCloseTo(450, 0);
  });

  it("parses CSV export", async () => {
    const csv = await readFixture("apple-health-export.csv");
    const parsed = parseAppleHealthCsv(csv);
    expect(parsed.records).toHaveLength(2);
    const metrics = parsed.records.flatMap((record) => normalizeAppleHealthRecord(record));
    expect(metrics).toHaveLength(2);
    expect(metrics[0]?.type).toBe("weight");
  });

  it("parses JSON export", async () => {
    const json = await readFixture("apple-health-export.json");
    const parsed = parseAppleHealthJson(json);
    expect(parsed.records).toHaveLength(1);
    const metrics = parsed.records.flatMap((record) => normalizeAppleHealthRecord(record));
    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.type).toBe("resting_hr");
  });

  it("parses ZIP exports containing export.xml", async () => {
    const xml = await readFixture("apple-health-export.xml");
    const zip = new JSZip();
    zip.file("export.xml", xml);
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    const parsed = await parseAppleHealthFile(bytes, "archive.zip", "application/zip");

    expect(parsed.sourceKind).toBe("zip:export.xml");
    expect(parsed.metrics.length).toBeGreaterThan(0);
  });
});
