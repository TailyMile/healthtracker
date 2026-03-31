import { appConfig, ensureGoogleEnv } from "@/lib/config";
import type { GoogleDriveTokenState } from "./types";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export function createGoogleDriveState() {
  return crypto.randomUUID();
}

export function buildGoogleDriveAuthUrl(state: string) {
  const { clientId, redirectUri } = ensureGoogleEnv();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", [DRIVE_SCOPE, USERINFO_SCOPE].join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeToken(body: URLSearchParams): Promise<GoogleDriveTokenState> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed: ${errorText}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    scope: json.scope,
    tokenType: json.token_type,
  };
}

export async function exchangeGoogleDriveCode(code: string): Promise<GoogleDriveTokenState> {
  const { clientId, clientSecret, redirectUri } = ensureGoogleEnv();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  return exchangeToken(body);
}

export async function refreshGoogleDriveToken(refreshToken: string): Promise<GoogleDriveTokenState> {
  const { clientId, clientSecret } = ensureGoogleEnv();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return exchangeToken(body);
}

export function isGoogleDriveConnected() {
  return Boolean(appConfig.google.clientId && appConfig.google.clientSecret && appConfig.google.redirectUri);
}
