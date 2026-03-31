import { NextRequest, NextResponse } from "next/server";
import { completeStravaOAuth } from "../../../../lib/integrations/strava/service";
import { jsonError, jsonOk, toErrorMessage } from "../../../../lib/utils/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    if (error) {
      return jsonError(error, 400);
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const expectedState = request.cookies.get("strava_oauth_state")?.value;

    if (!code) {
      return jsonError("Missing Strava authorization code", 400);
    }

    if (!state || !expectedState || state !== expectedState) {
      return jsonError("Invalid Strava OAuth state", 400);
    }

    await completeStravaOAuth({ code });
    const response = NextResponse.redirect(new URL("/import?strava=connected", request.url));
    response.cookies.delete("strava_oauth_state");
    return response;
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
