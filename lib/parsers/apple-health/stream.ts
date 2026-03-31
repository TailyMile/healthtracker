// @ts-expect-error sax does not ship TypeScript declarations in this setup.
import sax from "sax";
import JSZip from "jszip";
import type { Readable } from "node:stream";
import type { HealthMetric } from "@/lib/domain/types";
import { normalizeAppleHealthRecord, type AppleHealthRecordLike } from "./normalize";

interface StreamParseResult {
  metrics: HealthMetric[];
  warnings: string[];
  sourceKind: string;
}

type AggregateType = "sum" | "avg";

const AGGREGATES: Record<HealthMetric["type"], AggregateType | null> = {
  weight: null,
  body_fat_pct: null,
  heart_rate: "avg",
  resting_hr: null,
  steps: "sum",
  sleep_minutes: "sum",
  calories: "sum",
};

function pushAggregatedMetric(store: Map<string, { metric: HealthMetric; sum: number; count: number }>, metric: HealthMetric, mode: AggregateType) {
  const day = metric.observedAt.slice(0, 10);
  const key = `${metric.type}|${day}`;
  const existing = store.get(key);
  if (existing) {
    existing.sum += metric.value;
    existing.count += 1;
    return;
  }

  const representative: HealthMetric = {
    source: metric.source,
    type: metric.type,
    value: metric.value,
    unit: metric.unit,
    observedAt: `${day}T12:00:00.000Z`,
    raw: mode === "sum" ? { aggregated: "daily_sum" } : { aggregated: "daily_avg" }
  };

  store.set(key, { metric: representative, sum: metric.value, count: 1 });
}

function foldAggregates(store: Map<string, { metric: HealthMetric; sum: number; count: number }>, mode: AggregateType): HealthMetric[] {
  return [...store.values()].map((entry) => ({
    ...entry.metric,
    value: mode === "sum" ? entry.sum : entry.sum / Math.max(entry.count, 1)
  }));
}

function normalizeMetricsForStorage(metrics: HealthMetric[]) {
  const passthrough: HealthMetric[] = [];
  const sumStore = new Map<string, { metric: HealthMetric; sum: number; count: number }>();
  const avgStore = new Map<string, { metric: HealthMetric; sum: number; count: number }>();

  for (const metric of metrics) {
    const mode = AGGREGATES[metric.type];
    if (!mode) {
      passthrough.push(metric);
      continue;
    }

    if (mode === "sum") {
      pushAggregatedMetric(sumStore, metric, "sum");
      continue;
    }

    pushAggregatedMetric(avgStore, metric, "avg");
  }

  return [
    ...passthrough,
    ...foldAggregates(sumStore, "sum"),
    ...foldAggregates(avgStore, "avg")
  ];
}

function asStringAttr(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) {
    const nested = (value as { value?: unknown }).value;
    return typeof nested === "string" ? nested : undefined;
  }
  return undefined;
}

export async function parseAppleHealthXmlStream(stream: Readable, sourceKind = "xml"): Promise<StreamParseResult> {
  const parser = sax.createStream(true, { trim: true, normalize: true });
  const warnings: string[] = [];
  const parsedMetrics: HealthMetric[] = [];
  let currentRecord: AppleHealthRecordLike | null = null;
  let recordsCount = 0;

  parser.on("opentag", (tag: any) => {
    if (tag.name === "Record") {
      const attrs = tag.attributes as Record<string, unknown>;
      currentRecord = {
        type: asStringAttr(attrs.type) ?? "",
        value: asStringAttr(attrs.value),
        unit: asStringAttr(attrs.unit),
        startDate: asStringAttr(attrs.startDate),
        endDate: asStringAttr(attrs.endDate),
        sourceName: asStringAttr(attrs.sourceName),
        device: asStringAttr(attrs.device),
        metadata: {}
      };
      return;
    }

    if (tag.name === "MetadataEntry" && currentRecord) {
      const attrs = tag.attributes as Record<string, unknown>;
      const key = asStringAttr(attrs.key);
      const value = asStringAttr(attrs.value);
      if (key && value) {
        currentRecord.metadata = currentRecord.metadata ?? {};
        currentRecord.metadata[key] = value;
      }
    }
  });

  parser.on("closetag", (name: string) => {
    if (name !== "Record" || !currentRecord) {
      return;
    }

    recordsCount += 1;
    const normalized = normalizeAppleHealthRecord(currentRecord);
    if (normalized.length) {
      parsedMetrics.push(...normalized);
    }
    currentRecord = null;
  });

  parser.on("error", (error: unknown) => {
    parser.removeAllListeners();
    parser.emit("fatal_error", error);
  });

  await new Promise<void>((resolve, reject) => {
    parser.once("fatal_error", reject);
    parser.once("end", resolve);
    stream.pipe(parser);
  });

  if (!recordsCount) {
    warnings.push("No HealthData/Record nodes found in XML export.");
  }

  return {
    metrics: normalizeMetricsForStorage(parsedMetrics),
    warnings,
    sourceKind
  };
}

export async function parseAppleHealthZipBuffer(bytes: ArrayBuffer): Promise<StreamParseResult> {
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((left, right) => {
      const leftName = left.name.toLowerCase();
      const rightName = right.name.toLowerCase();
      const score = (name: string) => (name.endsWith("export.xml") ? 0 : name.endsWith(".xml") ? 1 : 9);
      return score(leftName) - score(rightName);
    });

  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (!(lower.endsWith("export.xml") || lower.endsWith(".xml"))) {
      continue;
    }

    const stream = file.nodeStream("nodebuffer") as unknown as Readable;
    return parseAppleHealthXmlStream(stream, `zip:${file.name}`);
  }

  return {
    metrics: [],
    warnings: ["No supported XML file was found in the ZIP archive."],
    sourceKind: "zip"
  };
}
