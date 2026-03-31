import { generateAndSaveReportBundle } from "@/lib/reports";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";

export const runtime = "nodejs";

export async function POST() {
  try {
    const bundle = await generateAndSaveReportBundle();
    return jsonOk(bundle);
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
