import { NextRequest, NextResponse } from "next/server";
import { saveOAuthToken } from "@/lib/db";
import { exchangeGoogleDriveCode } from "@/lib/integrations/google-drive/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("ht_google_drive_state")?.value;

  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing Google Drive auth code" }, { status: 400 });
  }

  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json({ ok: false, error: "Invalid Google Drive OAuth state" }, { status: 400 });
  }

  try {
    const tokens = await exchangeGoogleDriveCode(code);
    await saveOAuthToken({
      provider: "google",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      tokenType: tokens.tokenType
    });

    const response = NextResponse.redirect(new URL("/reports?drive=connected", request.url));
    response.cookies.delete("ht_google_drive_state");
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Google Drive callback failed" },
      { status: 500 },
    );
  }
}
