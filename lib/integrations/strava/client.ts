import type { Workout } from "../../domain/types";
import type { StravaActivity, StravaTokenResponse } from "./types";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export function buildStravaAuthorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(STRAVA_AUTHORIZE_URL);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "read,activity:read_all,profile:read_all");
  url.searchParams.set("state", options.state);
  return url.toString();
}

export async function exchangeCodeForToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<StravaTokenResponse> {
  const fetchFn = params.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    grant_type: "authorization_code"
  });
  body.set("redirect_uri", params.redirectUri);

  const response = await fetchFn(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Strava token exchange failed with status ${response.status}`);
  }

  return (await response.json()) as StravaTokenResponse;
}

export async function refreshStravaToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<StravaTokenResponse> {
  const fetchFn = params.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetchFn(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Strava token refresh failed with status ${response.status}`);
  }

  return (await response.json()) as StravaTokenResponse;
}

export function normalizeStravaActivity(activity: StravaActivity): Workout {
  const startedAt = activity.start_date ?? activity.start_date_local ?? new Date().toISOString();
  const type = String(activity.sport_type ?? activity.type ?? "ride").toLowerCase();

  return {
    id: String(activity.id),
    source: "strava",
    type,
    name: activity.name ?? undefined,
    startedAt,
    movingTimeSec: toNumber(activity.moving_time),
    elapsedTimeSec: toNumber(activity.elapsed_time),
    distanceM: toNumber(activity.distance),
    avgSpeedMps: toNumber(activity.average_speed),
    elevationM: toNumber(activity.total_elevation_gain),
    avgHr: toNumber(activity.average_heartrate),
    avgCadence: toNumber(activity.average_cadence),
    avgPower: toNumber(activity.average_watts),
    raw: {
      ...activity,
      source: "strava"
    }
  };
}

export async function fetchStravaActivities(params: {
  accessToken: string;
  after?: number | null;
  fetchImpl?: typeof fetch;
}) {
  const fetchFn = params.fetchImpl ?? fetch;
  const activities: StravaActivity[] = [];
  let page = 1;

  while (true) {
    const url = new URL(`${STRAVA_API_BASE}/athlete/activities`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    if (typeof params.after === "number" && Number.isFinite(params.after)) {
      url.searchParams.set("after", String(Math.floor(params.after)));
    }

    const response = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Strava activities fetch failed with status ${response.status}`);
    }

    const batch = (await response.json()) as StravaActivity[];
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    activities.push(...batch);
    if (batch.length < 100) {
      break;
    }

    page += 1;
  }

  return activities;
}

export async function ensureValidStravaAccessToken(params: {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  clientId: string;
  clientSecret: string;
  storeToken: (token: StravaTokenResponse) => Promise<void>;
  fetchImpl?: typeof fetch;
}) {
  const needsRefresh = params.expiresAt - Date.now() < 60_000;
  if (!needsRefresh || !params.refreshToken) {
    return { accessToken: params.accessToken, refreshed: false };
  }

  const token = await refreshStravaToken({
    refreshToken: params.refreshToken,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    fetchImpl: params.fetchImpl
  });

  await params.storeToken(token);
  return {
    accessToken: token.access_token,
    refreshed: true
  };
}

export function getStravaClientConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Strava env vars are not configured");
  }

  return { clientId, clientSecret, redirectUri };
}

function toNumber(value: unknown) {
  if (typeof value !== "number") return undefined;
  return Number.isFinite(value) ? value : undefined;
}
