import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { head, put } from "@vercel/blob";
import { appConfig } from "@/lib/config";
import type { HealthMetric, OAuthToken, ReportBundle, Workout } from "@/lib/domain/types";

export interface HealthMetricRow extends HealthMetric {
  id: number;
  dedupeKey: string;
}

export interface WorkoutRow extends Workout {
  id: string;
}

export interface ReportRow {
  kind: string;
  generatedAt: string;
  summaryJson: string;
  markdown: string;
}

interface PersistedState {
  version: number;
  nextMetricId: number;
  metrics: HealthMetricRow[];
  workouts: WorkoutRow[];
  oauthTokens: Record<string, OAuthToken>;
  syncState: Record<string, string | null>;
  reports: ReportRow[];
}

const STATE_VERSION = 1;
const STATE_PATH = appConfig.blob.statePath.endsWith(".sqlite")
  ? appConfig.blob.statePath.replace(/\.sqlite$/, ".json")
  : appConfig.blob.statePath;

let memoryState: PersistedState | null = null;

function createEmptyState(): PersistedState {
  return {
    version: STATE_VERSION,
    nextMetricId: 1,
    metrics: [],
    workouts: [],
    oauthTokens: {},
    syncState: {},
    reports: []
  };
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeState(raw: unknown): PersistedState {
  if (!raw || typeof raw !== "object") {
    return createEmptyState();
  }

  const state = raw as Partial<PersistedState>;
  return {
    version: typeof state.version === "number" ? state.version : STATE_VERSION,
    nextMetricId: typeof state.nextMetricId === "number" ? state.nextMetricId : 1,
    metrics: Array.isArray(state.metrics) ? state.metrics : [],
    workouts: Array.isArray(state.workouts) ? state.workouts : [],
    oauthTokens: state.oauthTokens && typeof state.oauthTokens === "object" ? state.oauthTokens : {},
    syncState: state.syncState && typeof state.syncState === "object" ? state.syncState : {},
    reports: Array.isArray(state.reports) ? state.reports : []
  };
}

async function loadState(): Promise<PersistedState> {
  if (memoryState) {
    return cloneState(memoryState);
  }

  if (!appConfig.blob.token) {
    memoryState = createEmptyState();
    return cloneState(memoryState);
  }

  try {
    const metadata = await head(STATE_PATH, { token: appConfig.blob.token });
    const response = await fetch(metadata.downloadUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to download state: ${response.status}`);
    }

    const json = (await response.json()) as unknown;
    memoryState = normalizeState(json);
    return cloneState(memoryState);
  } catch {
    memoryState = createEmptyState();
    return cloneState(memoryState);
  }
}

async function persistState(state: PersistedState) {
  memoryState = cloneState(state);

  if (!appConfig.blob.token) {
    return;
  }

  await put(STATE_PATH, Buffer.from(JSON.stringify(memoryState), "utf8"), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
    token: appConfig.blob.token
  });
}

async function withState<T>(callback: (state: PersistedState) => Promise<T> | T, options?: { write?: boolean }) {
  const state = await loadState();
  const result = await callback(state);
  if (options?.write) {
    await persistState(state);
  }
  return result;
}

function hashDedupeKey(parts: Array<string | number | undefined | null>) {
  return createHash("sha256").update(parts.map((value) => String(value ?? "")).join("|")).digest("hex");
}

export async function upsertHealthMetrics(metrics: HealthMetric[]) {
  if (!metrics.length) {
    return { inserted: 0 };
  }

  return withState(
    (state) => {
      let inserted = 0;
      for (const metric of metrics) {
        const dedupeKey = hashDedupeKey([metric.source, metric.type, metric.observedAt, metric.value, metric.unit]);
        const index = state.metrics.findIndex((row) => row.dedupeKey === dedupeKey);
        const next: HealthMetricRow = {
          id: index >= 0 ? state.metrics[index].id : state.nextMetricId++,
          dedupeKey,
          source: metric.source,
          type: metric.type,
          value: metric.value,
          unit: metric.unit,
          observedAt: metric.observedAt,
          raw: metric.raw
        };

        if (index >= 0) {
          state.metrics[index] = next;
        } else {
          state.metrics.push(next);
        }
        inserted += 1;
      }
      return { inserted };
    },
    { write: true }
  );
}

export async function listHealthMetrics() {
  return withState((state) =>
    [...state.metrics]
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id - b.id)
      .map((row) => ({ ...row }))
  );
}

export async function listWorkouts() {
  return withState((state) => [...state.workouts].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id)));
}

export async function upsertWorkouts(workouts: Workout[]) {
  if (!workouts.length) {
    return { inserted: 0 };
  }

  return withState(
    (state) => {
      let inserted = 0;
      for (const workout of workouts) {
        const index = state.workouts.findIndex((row) => row.id === workout.id);
        const next: WorkoutRow = { ...workout };
        if (index >= 0) {
          state.workouts[index] = next;
        } else {
          state.workouts.push(next);
        }
        inserted += 1;
      }
      return { inserted };
    },
    { write: true }
  );
}

export async function saveOAuthToken(token: OAuthToken) {
  return withState(
    (state) => {
      state.oauthTokens[token.provider] = { ...token };
      return { ok: true };
    },
    { write: true }
  );
}

export async function getOAuthToken(provider: OAuthToken["provider"]) {
  return withState((state) => {
    const token = state.oauthTokens[provider];
    return token ? ({ ...token } satisfies OAuthToken) : null;
  });
}

export async function saveSyncState(provider: string, lastSyncAt: string | null) {
  return withState(
    (state) => {
      state.syncState[provider] = lastSyncAt;
      return { ok: true };
    },
    { write: true }
  );
}

export async function getSyncState(provider: string) {
  return withState((state) => {
    if (!(provider in state.syncState)) {
      return null;
    }

    return {
      provider,
      lastSyncAt: state.syncState[provider] ?? undefined
    };
  });
}

export async function saveReport(kind: string, generatedAt: string, summaryJson: unknown, markdown: string) {
  return withState(
    (state) => {
      const row: ReportRow = {
        kind,
        generatedAt,
        summaryJson: JSON.stringify(summaryJson),
        markdown
      };

      const index = state.reports.findIndex((report) => report.kind === kind);
      if (index >= 0) {
        state.reports[index] = row;
      } else {
        state.reports.push(row);
      }

      return { ok: true };
    },
    { write: true }
  );
}

export async function listReports() {
  return withState((state) =>
    [...state.reports]
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || a.kind.localeCompare(b.kind))
      .map((row) => ({ ...row }))
  );
}

export async function getReport(kind: string) {
  return withState((state) => {
    const row = state.reports.find((item) => item.kind === kind);
    return row ? { ...row } : null;
  });
}

export async function getLatestReportBundle() {
  const row = await getReport("latest");
  if (!row) {
    return null;
  }

  return JSON.parse(row.summaryJson) as ReportBundle;
}

export async function getAllWorkoutsAndMetrics() {
  const [workouts, metrics] = await Promise.all([listWorkouts(), listHealthMetrics()]);
  return { workouts, metrics };
}

export async function getDashboardRows() {
  const { workouts, metrics } = await getAllWorkoutsAndMetrics();
  return { workouts, metrics };
}
