import { cookies } from "next/headers";
import type { GoogleDriveTokenState } from "./types";

const COOKIE_NAME = "ht_google_drive_tokens";

export function serializeGoogleDriveTokens(value: GoogleDriveTokenState) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function deserializeGoogleDriveTokens(value: string): GoogleDriveTokenState | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as GoogleDriveTokenState;
  } catch {
    return null;
  }
}

export async function readGoogleDriveTokens(): Promise<GoogleDriveTokenState | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return deserializeGoogleDriveTokens(raw);
}
