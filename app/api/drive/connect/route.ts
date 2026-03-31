import { NextResponse } from "next/server";
import { buildGoogleDriveAuthUrl, createGoogleDriveState } from "@/lib/integrations/google-drive/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = createGoogleDriveState();
  const response = NextResponse.redirect(buildGoogleDriveAuthUrl(state));
  response.cookies.set("ht_google_drive_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
