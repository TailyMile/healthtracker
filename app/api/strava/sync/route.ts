import { NextRequest } from "next/server";
import { syncStravaActivities } from "../../../../lib/integrations/strava/service";
import { jsonError, jsonOk, toErrorMessage } from "../../../../lib/utils/api";

export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  try {
    const result = await syncStravaActivities();
    return jsonOk({
      ...result,
      imported: result.syncedCount
    });
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
