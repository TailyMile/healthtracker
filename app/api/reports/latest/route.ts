import { getLatestPersistedReportBundle } from "@/lib/reports";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const bundle = await getLatestPersistedReportBundle();
    if (!bundle) {
      return jsonError("report not found", 404);
    }

    return jsonOk({
      generatedAt: bundle.generatedAt,
      daily: bundle.daily,
      weekly: bundle.weekly,
      monthly: bundle.monthly,
      latestMarkdown: bundle.latestMarkdown,
      markdown: bundle.latestMarkdown,
      bundle
    });
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
