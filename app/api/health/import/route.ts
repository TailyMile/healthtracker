import type { HealthMetric } from "@/lib/domain/types";
import { upsertHealthMetrics } from "@/lib/db";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";
import { parseAppleHealthFile } from "@/lib/parsers/apple-health";

export const runtime = "nodejs";

async function persistMetrics(metrics: HealthMetric[]) {
  const result = await upsertHealthMetrics(metrics);
  return { attempted: true, persisted: result.inserted, note: "Metrics were stored in app state." };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploaded = formData.get("file");

    if (!(uploaded instanceof File)) {
      return jsonError("Upload a file field named 'file'.", 400);
    }

    const bytes = await uploaded.arrayBuffer();
    const parsed = await parseAppleHealthFile(bytes, uploaded.name, uploaded.type || undefined);
    const persistence = await persistMetrics(parsed.metrics);

    return jsonOk({
      fileName: uploaded.name,
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
