export interface StravaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
  athlete?: {
    id?: number;
    username?: string;
    firstname?: string;
    lastname?: string;
  };
}

export interface StravaActivity {
  id: number | string;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date?: string;
  start_date_local?: string;
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  average_speed?: number;
  total_elevation_gain?: number;
  average_heartrate?: number | null;
  average_cadence?: number | null;
  average_watts?: number | null;
  workout_type?: number | null;
  updated_at?: string;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  raw?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StravaSyncResult {
  syncedCount: number;
  upsertedCount: number;
  lastSyncAt: number | null;
  refreshed: boolean;
}

export interface StravaStoreToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}
