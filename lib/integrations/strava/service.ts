import type { OAuthToken, Workout } from "../../domain/types";
import { exchangeCodeForToken, fetchStravaActivities, ensureValidStravaAccessToken, normalizeStravaActivity, refreshStravaToken } from "./client";
import type { StravaActivity, StravaSyncResult, StravaTokenResponse } from "./types";
import { getStravaStore } from "./store";

function mapTokenResponse(token: StravaTokenResponse): OAuthToken {
  return {
    provider: "strava",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_at * 1000,
    scope: token.scope,
    tokenType: token.token_type
  };
}

function mapActivities(activities: StravaActivity[]): Workout[] {
  return activities.map(normalizeStravaActivity);
}

export async function startStravaOAuth(state: string) {
  const strava = getStravaEnv();
  if (!strava.clientId || !strava.redirectUri) {
    throw new Error("Strava env vars are not configured");
  }

  const { buildStravaAuthorizeUrl } = await import("./client");
  return buildStravaAuthorizeUrl({ clientId: strava.clientId, redirectUri: strava.redirectUri, state });
}

export async function completeStravaOAuth(params: {
  code: string;
  fetchImpl?: typeof fetch;
}) {
  const strava = getStravaEnv();
  if (!strava.clientId || !strava.clientSecret || !strava.redirectUri) {
    throw new Error("Strava env vars are not configured");
  }

  const token = await exchangeCodeForToken({
    code: params.code,
    clientId: strava.clientId,
    clientSecret: strava.clientSecret,
    redirectUri: strava.redirectUri,
    fetchImpl: params.fetchImpl
  });

  const mapped = mapTokenResponse(token);
  await getStravaStore().setToken(mapped);
  return mapped;
}

export async function refreshStoredStravaToken(params?: { fetchImpl?: typeof fetch }) {
  const strava = getStravaEnv();
  if (!strava.clientId || !strava.clientSecret) {
    throw new Error("Strava env vars are not configured");
  }

  const current = await getStravaStore().getToken();
  if (!current || current.provider !== "strava") {
    throw new Error("No stored Strava token found");
  }

  if (!current.refreshToken) {
    return { token: current, refreshed: false };
  }

  if (current.expiresAt - Date.now() >= 60_000) {
    return { token: current, refreshed: false };
  }

  const token = await refreshStravaToken({
    refreshToken: current.refreshToken,
    clientId: strava.clientId,
    clientSecret: strava.clientSecret,
    fetchImpl: params?.fetchImpl
  });

  const mapped = mapTokenResponse(token);
  await getStravaStore().setToken(mapped);
  return { token: mapped, refreshed: true };
}

export async function syncStravaActivities(params?: { fetchImpl?: typeof fetch }): Promise<StravaSyncResult> {
  const strava = getStravaEnv();
  if (!strava.clientId || !strava.clientSecret) {
    throw new Error("Strava env vars are not configured");
  }

  const store = getStravaStore();
  const current = await store.getToken();
  if (!current || current.provider !== "strava") {
    throw new Error("No stored Strava token found");
  }

  const validToken = await ensureValidStravaAccessToken({
    accessToken: current.accessToken,
    refreshToken: current.refreshToken,
    expiresAt: current.expiresAt,
    clientId: strava.clientId,
    clientSecret: strava.clientSecret,
    fetchImpl: params?.fetchImpl,
    storeToken: async (token) => {
      await store.setToken(mapTokenResponse(token));
    }
  });

  const lastSyncAt = await store.getLastSyncAt();
  const activities = await fetchStravaActivities({
    accessToken: validToken.accessToken,
    after: lastSyncAt,
    fetchImpl: params?.fetchImpl
  });

  const workouts = mapActivities(activities);
  const upsertedCount = await store.upsertWorkouts(workouts);
  const maxUpdatedAt = activities.reduce((max, activity) => {
    const updated = toEpochMs(activity.updated_at ?? activity.start_date);
    return updated > max ? updated : max;
  }, lastSyncAt ?? 0);

  const effectiveLastSyncAt = maxUpdatedAt > 0 ? maxUpdatedAt : Date.now();
  await store.setLastSyncAt(effectiveLastSyncAt);

  return {
    syncedCount: activities.length,
    upsertedCount,
    lastSyncAt: effectiveLastSyncAt,
    refreshed: validToken.refreshed
  };
}

export async function getStravaDashboardSummary() {
  const store = getStravaStore();
  const [workoutCount, totals, recentWorkouts, token] = await Promise.all([
    store.getWorkoutCount(),
    store.getTotals(),
    store.listRecentWorkouts(5),
    store.getToken()
  ]);

  return {
    connected: Boolean(token?.accessToken),
    workoutCount,
    totals,
    recentWorkouts,
    lastSyncAt: await store.getLastSyncAt()
  };
}

function toEpochMs(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStravaEnv() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  return { clientId, clientSecret, redirectUri };
}
