export type HealthMetricType =
  | "weight"
  | "body_fat_pct"
  | "heart_rate"
  | "resting_hr"
  | "steps"
  | "sleep_minutes"
  | "calories";

export type MetricSource = "apple_health" | "manual";

export type WorkoutSource = "strava" | "apple_health";

export interface HealthMetric {
  source: MetricSource;
  type: HealthMetricType;
  value: number;
  unit?: string;
  observedAt: string;
  raw?: Record<string, unknown>;
}

export interface Workout {
  id: string;
  source: WorkoutSource;
  type: string;
  name?: string;
  startedAt: string;
  movingTimeSec?: number;
  elapsedTimeSec?: number;
  distanceM?: number;
  avgSpeedMps?: number;
  elevationM?: number;
  avgHr?: number;
  avgCadence?: number;
  avgPower?: number;
  raw?: Record<string, unknown>;
}

export interface OAuthToken {
  provider: "strava" | "google";
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}

export interface ActivityTotals {
  workouts: number;
  totalDistanceKm: number;
  totalMovingHours: number;
  totalElevationM: number;
}

export interface RecoverySnapshot {
  avgSleepMinutes7d: number;
  avgRestingHr7d: number;
  baselineRestingHr28d: number;
}

export interface ReportSummary {
  title: string;
  period: string;
  generatedAt: string;
  totals: ActivityTotals;
  currentWeightKg?: number;
  weightDeltaKg?: number;
  recovery: RecoverySnapshot;
  flags: string[];
  latestRides: Array<{
    date: string;
    name: string;
    distanceKm: number;
    movingTimeMin: number;
    elevationM: number;
    avgHr?: number;
  }>;
}

export type ReportPreset = "day" | "week" | "month" | "year" | "custom";

export interface ReportRange {
  preset: ReportPreset;
  start: string;
  end: string;
  label: string;
}

export interface ReportBundle {
  daily: ReportSummary;
  weekly: ReportSummary;
  monthly: ReportSummary;
  selected?: ReportSummary;
  selectedRange?: ReportRange;
  latestMarkdown: string;
  generatedAt: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;
