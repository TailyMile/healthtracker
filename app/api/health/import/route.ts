import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { HealthMetric } from "@/lib/domain/types";
import { listHealthMetrics, upsertHealthMetrics } from "@/lib/db";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";
import { parseAppleHealthFile } from "@/lib/parsers/apple-health";
import { detectAppleHealthFileKind } from "@/lib/parsers/apple-health/detect";
import { parseAppleHealthXmlStream } from "@/lib/parsers/apple-health/stream";

export const runtime = "nodejs";

interface ImportByBlobBody {
  blobUrl?: string;
  fileName?: string;
  mimeType?: string;
}

type ImportMode = "initial_last_year" | "incremental_new_only";

const APPLE_MINIMAL_TYPES: Array<HealthMetric["type"]> = [
  "weight",
  "body_fat_pct",
  "resting_hr",
  "sleep_minutes",
  "steps",
];

function toIsoYearAgo(now = Date.now()) {
  const yearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);
  return yearAgo.toISOString();
}

function buildPolicy(existingMetrics: HealthMetric[]) {
  const latestByType = new Map<HealthMetric["type"], string>();

  for (const metric of existingMetrics) {
    if (metric.source !== "apple_health") continue;
    if (!APPLE_MINIMAL_TYPES.includes(metric.type)) continue;
    const current = latestByType.get(metric.type);
    if (!current || metric.observedAt > current) {
      latestByType.set(metric.type, metric.observedAt);
    }
  }

  const hasAnyAppleMinimal = latestByType.size > 0;
  const mode: ImportMode = hasAnyAppleMinimal ? "incremental_new_only" : "initial_last_year";
  const initialFrom = toIsoYearAgo();

  return {
    mode,
    initialFrom,
    latestByType,
  };
}

function shouldImportMetric(metric: HealthMetric, policy: ReturnType<typeof buildPolicy>) {
  if (metric.source !== "apple_health") {
    return false;
  }
  if (!APPLE_MINIMAL_TYPES.includes(metric.type)) {
    return false;
  }

  if (policy.mode === "initial_last_year") {
    return metric.observedAt >= policy.initialFrom;
  }

  const latest = policy.latestByType.get(metric.type);
  if (!latest) {
    return true;
  }
  return metric.observedAt > latest;
}

async function persistMetrics(metrics: HealthMetric[]) {
  const result = await upsertHealthMetrics(metrics);
  return { attempted: true, persisted: result.inserted, note: "Metrics were stored in app state." };
}

function getFileNameFromUrl(blobUrl: string) {
  try {
    const pathname = new URL(blobUrl).pathname;
    const parts = pathname.split("/");
    const fileName = parts[parts.length - 1];
    return fileName || "export.xml";
  } catch {
    return "export.xml";
  }
}

function isAllowedBlobUrl(blobUrl: string) {
  try {
    const url = new URL(blobUrl);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const existingMetrics = await listHealthMetrics();
    const policy = buildPolicy(existingMetrics);

    const contentType = request.headers.get("content-type") ?? "";
    let bytes: ArrayBuffer;
    let fileName = "export.xml";
    let mimeType: string | undefined;

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as ImportByBlobBody;
      if (!body.blobUrl) {
        return jsonError("Missing blobUrl in request body.", 400);
      }

      if (!isAllowedBlobUrl(body.blobUrl)) {
        return jsonError("blobUrl must point to Vercel Blob public URL.", 400);
      }

      const sourceResponse = await fetch(body.blobUrl, { cache: "no-store" });
      if (!sourceResponse.ok) {
        return jsonError(`Failed to fetch blob file (${sourceResponse.status}).`, 400);
      }

      fileName = body.fileName || getFileNameFromUrl(body.blobUrl);
      mimeType = body.mimeType || sourceResponse.headers.get("content-type") || undefined;
      const kind = detectAppleHealthFileKind(fileName, mimeType);

      if (kind === "xml" && sourceResponse.body) {
        const nodeStream = Readable.fromWeb(sourceResponse.body as unknown as NodeReadableStream<Uint8Array>);
        const parsed = await parseAppleHealthXmlStream(nodeStream, "xml", {
          metricFilter: (metric) => shouldImportMetric(metric, policy)
        });
        const persistence = await persistMetrics(parsed.metrics);

        return jsonOk({
          fileName,
          sourceKind: parsed.sourceKind,
          importMode: policy.mode,
          appliedTypes: APPLE_MINIMAL_TYPES,
          windowStart: policy.mode === "initial_last_year" ? policy.initialFrom : undefined,
          imported: parsed.metrics.length,
          metricsCount: parsed.metrics.length,
          workoutCount: 0,
          warnings: parsed.warnings,
          persistence
        });
      }

      if (kind === "zip") {
        return jsonError("ZIP import via blob is disabled on server to avoid memory overflow. Extract export.xml on client and retry.", 400);
      }

      bytes = await sourceResponse.arrayBuffer();
    } else {
      const formData = await request.formData();
      const uploaded = formData.get("file");

      if (!(uploaded instanceof File)) {
        return jsonError("Upload a file field named 'file' or pass JSON with blobUrl.", 400);
      }

      bytes = await uploaded.arrayBuffer();
      fileName = uploaded.name;
      mimeType = uploaded.type || undefined;
    }

    const parsed = await parseAppleHealthFile(bytes, fileName, mimeType);
    const filteredMetrics = parsed.metrics.filter((metric) => shouldImportMetric(metric, policy));
    const persistence = await persistMetrics(filteredMetrics);

    return jsonOk({
      fileName,
      sourceKind: parsed.sourceKind,
      importMode: policy.mode,
      appliedTypes: APPLE_MINIMAL_TYPES,
      windowStart: policy.mode === "initial_last_year" ? policy.initialFrom : undefined,
      imported: filteredMetrics.length,
      metricsCount: filteredMetrics.length,
      workoutCount: parsed.workouts.length,
      warnings: parsed.warnings,
      persistence
    });
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
