import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { HealthMetric } from "@/lib/domain/types";
import { upsertHealthMetrics } from "@/lib/db";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";
import { parseAppleHealthFile } from "@/lib/parsers/apple-health";
import { detectAppleHealthFileKind } from "@/lib/parsers/apple-health/detect";
import { parseAppleHealthXmlStream, parseAppleHealthZipBuffer } from "@/lib/parsers/apple-health/stream";

export const runtime = "nodejs";

interface ImportByBlobBody {
  blobUrl?: string;
  fileName?: string;
  mimeType?: string;
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
        const parsed = await parseAppleHealthXmlStream(nodeStream, "xml");
        const persistence = await persistMetrics(parsed.metrics);

        return jsonOk({
          fileName,
          sourceKind: parsed.sourceKind,
          imported: parsed.metrics.length,
          metricsCount: parsed.metrics.length,
          workoutCount: 0,
          warnings: parsed.warnings,
          persistence
        });
      }

      bytes = await sourceResponse.arrayBuffer();
      if (kind === "zip") {
        const parsed = await parseAppleHealthZipBuffer(bytes);
        const persistence = await persistMetrics(parsed.metrics);

        return jsonOk({
          fileName,
          sourceKind: parsed.sourceKind,
          imported: parsed.metrics.length,
          metricsCount: parsed.metrics.length,
          workoutCount: 0,
          warnings: parsed.warnings,
          persistence
        });
      }
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
    const persistence = await persistMetrics(parsed.metrics);

    return jsonOk({
      fileName,
      sourceKind: parsed.sourceKind,
      imported: parsed.metrics.length,
      metricsCount: parsed.metrics.length,
      workoutCount: parsed.workouts.length,
      warnings: parsed.warnings,
      persistence
    });
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
