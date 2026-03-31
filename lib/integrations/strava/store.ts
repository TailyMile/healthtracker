import {
  getOAuthToken,
  getSyncState,
  listWorkouts,
  saveOAuthToken,
  saveSyncState,
  upsertWorkouts
} from "../../db";
import { calculateActivityTotals } from "../../domain/metrics";
import type { OAuthToken, Workout } from "../../domain/types";

export interface StravaStore {
  getToken(): Promise<OAuthToken | null>;
  setToken(token: OAuthToken): Promise<void>;
  getLastSyncAt(): Promise<number | null>;
  setLastSyncAt(value: number | null): Promise<void>;
  upsertWorkouts(workouts: Workout[]): Promise<number>;
  listRecentWorkouts(limit: number): Promise<Workout[]>;
  getWorkoutCount(): Promise<number>;
  getTotals(): Promise<{
    workouts: number;
    totalDistanceKm: number;
    totalMovingHours: number;
    totalElevationM: number;
  }>;
}

type StoreState = {
  token: OAuthToken | null;
  lastSyncAt: number | null;
  workouts: Map<string, Workout>;
};

const globalKey = "__healthtracker_strava_store__";

function getState(): StoreState {
  const g = globalThis as typeof globalThis & { [globalKey]?: StoreState };
  if (!g[globalKey]) {
    g[globalKey] = {
      token: null,
      lastSyncAt: null,
      workouts: new Map<string, Workout>()
    };
  }
  return g[globalKey]!;
}

class MemoryStravaStore implements StravaStore {
  async getToken() {
    return getState().token;
  }

  async setToken(token: OAuthToken) {
    getState().token = token;
  }

  async getLastSyncAt() {
    return getState().lastSyncAt;
  }

  async setLastSyncAt(value: number | null) {
    getState().lastSyncAt = value;
  }

  async upsertWorkouts(workouts: Workout[]) {
    const state = getState();
    let upserted = 0;
    for (const workout of workouts) {
      state.workouts.set(workout.id, workout);
      upserted += 1;
    }
    return upserted;
  }

  async listRecentWorkouts(limit: number) {
    return [...getState().workouts.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  async getWorkoutCount() {
    return getState().workouts.size;
  }

  async getTotals() {
    return calculateActivityTotals([...getState().workouts.values()]);
  }
}

class DbStravaStore implements StravaStore {
  async getToken() {
    return getOAuthToken("strava");
  }

  async setToken(token: OAuthToken) {
    await saveOAuthToken({ ...token, provider: "strava" });
  }

  async getLastSyncAt() {
    const row = await getSyncState("strava");
    if (!row?.lastSyncAt) {
      return null;
    }

    const parsed = Date.parse(row.lastSyncAt);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async setLastSyncAt(value: number | null) {
    await saveSyncState("strava", value ? new Date(value).toISOString() : null);
  }

  async upsertWorkouts(workouts: Workout[]) {
    const result = await upsertWorkouts(workouts.map((workout) => ({ ...workout, source: "strava" })));
    return result.inserted;
  }

  async listRecentWorkouts(limit: number) {
    const workouts = await listWorkouts();
    return workouts
      .filter((workout) => workout.source === "strava")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  async getWorkoutCount() {
    const workouts = await this.listRecentWorkouts(Number.MAX_SAFE_INTEGER);
    return workouts.length;
  }

  async getTotals() {
    const workouts = await this.listRecentWorkouts(Number.MAX_SAFE_INTEGER);
    return calculateActivityTotals(workouts);
  }
}

let activeStore: StravaStore = new DbStravaStore();

export function getStravaStore() {
  return activeStore;
}

export function setStravaStore(store: StravaStore) {
  activeStore = store;
}

export function resetStravaStore() {
  activeStore = new MemoryStravaStore();
}

export function createMemoryStravaStore(): StravaStore {
  return new MemoryStravaStore();
}

export function useDbStravaStore() {
  activeStore = new DbStravaStore();
}
