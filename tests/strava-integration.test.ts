import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as connectGET } from "../app/api/strava/connect/route";
import { GET as callbackGET } from "../app/api/strava/callback/route";
import { POST as syncPOST } from "../app/api/strava/sync/route";
import { buildStravaAuthorizeUrl } from "../lib/integrations/strava/client";
import { createMemoryStravaStore, resetStravaStore, setStravaStore, getStravaStore } from "../lib/integrations/strava/store";

const originalEnv = {
  STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET,
  STRAVA_REDIRECT_URI: process.env.STRAVA_REDIRECT_URI
};

describe("Strava integration", () => {
  beforeEach(() => {
    process.env.STRAVA_CLIENT_ID = "client-id";
    process.env.STRAVA_CLIENT_SECRET = "client-secret";
    process.env.STRAVA_REDIRECT_URI = "https://example.com/api/strava/callback";
    resetStravaStore();
    setStravaStore(createMemoryStravaStore());
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.STRAVA_CLIENT_ID = originalEnv.STRAVA_CLIENT_ID;
    process.env.STRAVA_CLIENT_SECRET = originalEnv.STRAVA_CLIENT_SECRET;
    process.env.STRAVA_REDIRECT_URI = originalEnv.STRAVA_REDIRECT_URI;
  });

  it("builds a Strava OAuth URL with expected params", () => {
    const url = buildStravaAuthorizeUrl({
      clientId: "client-id",
      redirectUri: "https://example.com/api/strava/callback",
      state: "state-123"
    });

    expect(url).toContain("client_id=client-id");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fapi%2Fstrava%2Fcallback");
    expect(url).toContain("scope=read%2Cactivity%3Aread_all%2Cprofile%3Aread_all");
    expect(url).toContain("state=state-123");
  });

  it("connect route redirects to Strava and stores state cookie", async () => {
    const request = new NextRequest("https://example.com/api/strava/connect");

    const response = await connectGET(request);
    const location = response.headers.get("location");
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(307);
    expect(location).toContain("https://www.strava.com/oauth/authorize");
    expect(location).toContain("client_id=client-id");
    expect(setCookie).toContain("strava_oauth_state=");
  });

  it("callback route exchanges code and stores token", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "access-1",
          refresh_token: "refresh-1",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          scope: "read,activity:read_all",
          token_type: "Bearer"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "https://example.com/api/strava/callback?code=auth-code&state=state-123",
      {
        headers: {
          cookie: "strava_oauth_state=state-123"
        }
      }
    );

    const response = await callbackGET(request);
    const location = response.headers.get("location");
    const stored = await getStravaStore().getToken();

    expect(response.status).toBe(307);
    expect(location).toContain("/import?strava=connected");
    expect(stored?.accessToken).toBe("access-1");
    expect(stored?.refreshToken).toBe("refresh-1");
  });

  it("sync route refreshes and paginates activities", async () => {
    const store = createMemoryStravaStore();
    await store.setToken({
      provider: "strava",
      accessToken: "expired-token",
      refreshToken: "refresh-1",
      expiresAt: Date.now() - 1000
    });
    await store.setLastSyncAt(null);
    setStravaStore(store);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth/token")) {
        return new Response(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            scope: "read,activity:read_all",
            token_type: "Bearer"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("page=1")) {
        return new Response(
          JSON.stringify([
            {
              id: 101,
              name: "Morning ride",
              type: "Ride",
              start_date: "2026-03-30T06:00:00Z",
              moving_time: 3600,
              elapsed_time: 3900,
              distance: 25000,
              average_speed: 6.94,
              total_elevation_gain: 180,
              average_heartrate: 143,
              average_cadence: 81,
              average_watts: 185,
              updated_at: "2026-03-30T08:00:00Z"
            },
            {
              id: 102,
              name: "Evening ride",
              type: "Ride",
              start_date: "2026-03-31T16:00:00Z",
              moving_time: 4200,
              elapsed_time: 4500,
              distance: 30000,
              average_speed: 7.14,
              total_elevation_gain: 240,
              average_heartrate: 149,
              average_cadence: 84,
              average_watts: 198,
              updated_at: "2026-03-31T18:30:00Z"
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("https://example.com/api/strava/sync", { method: "POST" });
    const response = await syncPOST(request);
    const body = (await response.json()) as {
      ok: boolean;
      data?: { syncedCount: number; upsertedCount: number; refreshed: boolean };
    };
    const totals = await store.getTotals();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.syncedCount).toBe(2);
    expect(body.data?.upsertedCount).toBe(2);
    expect(body.data?.refreshed).toBe(true);
    expect(totals.workouts).toBe(2);
    expect(totals.totalDistanceKm).toBeCloseTo(55, 1);
  });
});
