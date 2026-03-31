import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { startStravaOAuth } from "../../../../lib/integrations/strava/service";
import { jsonError, toErrorMessage } from "../../../../lib/utils/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const state = randomUUID();
    const url = await startStravaOAuth(state);
    const response = NextResponse.redirect(url);

    response.cookies.set("strava_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 10 * 60
    });

    return response;
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
