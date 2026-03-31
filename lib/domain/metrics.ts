import { compareDesc, parseISO, startOfDay, subDays } from "date-fns";
import type { ActivityTotals, HealthMetric, RecoverySnapshot, ReportSummary, Workout } from "@/lib/domain/types";

function toDate(value: string | Date) {
  return value instanceof Date ? value : parseISO(value);
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0);
}

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

function inRange(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}

export function normalizeWorkoutSort(workouts: Workout[]) {
  return [...workouts].sort((a, b) => compareDesc(toDate(a.startedAt), toDate(b.startedAt)));
}

export function calculateActivityTotals(workouts: Workout[]): ActivityTotals {
  const totalDistanceM = sum(workouts.map((workout) => workout.distanceM ?? 0));
  const totalMovingHours = sum(workouts.map((workout) => (workout.movingTimeSec ?? 0) / 3600));
  const totalElevationM = sum(workouts.map((workout) => workout.elevationM ?? 0));

  return {
    workouts: workouts.length,
    totalDistanceKm: round(totalDistanceM / 1000, 1),
    totalMovingHours: round(totalMovingHours, 1),
    totalElevationM: round(totalElevationM, 0)
  };
}

export function getLatestWeight(metrics: HealthMetric[]) {
  const latest = metrics
    .filter((metric) => metric.type === "weight")
    .sort((a, b) => compareDesc(toDate(a.observedAt), toDate(b.observedAt)))[0];

  return latest?.value;
}

export function getWeightDelta(metrics: HealthMetric[], now = new Date(), lookbackDays = 7) {
  const latest = metrics
    .filter((metric) => metric.type === "weight")
    .sort((a, b) => compareDesc(toDate(a.observedAt), toDate(b.observedAt)))[0];

  if (!latest) {
    return undefined;
  }

  const targetDate = subDays(toDate(now), lookbackDays);
  const older = metrics
    .filter((metric) => metric.type === "weight" && toDate(metric.observedAt) <= targetDate)
    .sort((a, b) => compareDesc(toDate(a.observedAt), toDate(b.observedAt)))[0];

  if (!older) {
    return undefined;
  }

  return round(latest.value - older.value, 1);
}

export function calculateRecoverySnapshot(metrics: HealthMetric[], now = new Date()): RecoverySnapshot {
  const window7Start = subDays(startOfDay(now), 7);
  const window28Start = subDays(startOfDay(now), 28);

  const recentSleep = metrics.filter((metric) => metric.type === "sleep_minutes" && inRange(toDate(metric.observedAt), window7Start, now));
  const recentRestingHr = metrics.filter((metric) => metric.type === "resting_hr" && inRange(toDate(metric.observedAt), window7Start, now));
  const baselineRestingHr = metrics.filter((metric) => metric.type === "resting_hr" && inRange(toDate(metric.observedAt), window28Start, now));

  return {
    avgSleepMinutes7d: round(average(recentSleep.map((metric) => metric.value)), 0),
    avgRestingHr7d: round(average(recentRestingHr.map((metric) => metric.value)), 0),
    baselineRestingHr28d: round(average(baselineRestingHr.map((metric) => metric.value)), 0)
  };
}

function windowTotalDistance(workouts: Workout[], start: Date, end: Date) {
  return sum(
    workouts
      .filter((workout) => inRange(toDate(workout.startedAt), start, end))
      .map((workout) => workout.distanceM ?? 0)
  );
}

export function detectFlags(workouts: Workout[], metrics: HealthMetric[], now = new Date(), windowDays = 7) {
  const windowEnd = now;
  const currentStart = subDays(startOfDay(windowEnd), windowDays);
  const previousStart = subDays(currentStart, windowDays * 4);
  const previousEnd = currentStart;

  const currentDistance = windowTotalDistance(workouts, currentStart, windowEnd);
  const previousDistance = windowTotalDistance(workouts, previousStart, previousEnd);
  const previousAverage = previousDistance > 0 ? previousDistance / 4 : currentDistance;

  const recovery = calculateRecoverySnapshot(metrics, now);
  const flags: string[] = [];

  if (previousAverage > 0 && currentDistance > previousAverage * 1.4) {
    flags.push("overload");
  }

  if (previousAverage > 0 && currentDistance < previousAverage * 0.6) {
    flags.push("underload");
  }

  if (
    recovery.avgSleepMinutes7d > 0 &&
    (recovery.avgSleepMinutes7d < 420 || (recovery.baselineRestingHr28d > 0 && recovery.avgRestingHr7d > recovery.baselineRestingHr28d + 3))
  ) {
    flags.push("recovery_risk");
  }

  return [...new Set(flags)];
}

export function selectLatestRides(workouts: Workout[], limit = 5) {
  return normalizeWorkoutSort(workouts)
    .filter((workout) => {
      const type = workout.type.toLowerCase();
      return type.includes("ride") || type.includes("bike") || type.includes("cycling");
    })
    .slice(0, limit)
    .map((workout) => ({
      date: workout.startedAt,
      name: workout.name ?? workout.type,
      distanceKm: round((workout.distanceM ?? 0) / 1000, 1),
      movingTimeMin: round((workout.movingTimeSec ?? 0) / 60, 0),
      elevationM: round(workout.elevationM ?? 0, 0),
      avgHr: workout.avgHr
    }));
}

export function buildSummary(params: {
  title: string;
  period: string;
  generatedAt: string;
  workouts: Workout[];
  metrics: HealthMetric[];
  windowDays: number;
  ridesLimit?: number;
}): ReportSummary {
  const { title, period, generatedAt, workouts, metrics, windowDays, ridesLimit = 5 } = params;
  const end = toDate(generatedAt);
  const start = subDays(end, windowDays);
  const summaryWorkouts = workouts.filter((workout) => {
    const startedAt = toDate(workout.startedAt);
    return inRange(startedAt, start, end);
  });

  return {
    title,
    period,
    generatedAt,
    totals: calculateActivityTotals(summaryWorkouts),
    currentWeightKg: getLatestWeight(metrics),
    weightDeltaKg: getWeightDelta(metrics, new Date(generatedAt), windowDays),
    recovery: calculateRecoverySnapshot(metrics, new Date(generatedAt)),
    flags: detectFlags(workouts, metrics, new Date(generatedAt), windowDays),
    latestRides: selectLatestRides(summaryWorkouts, ridesLimit)
  };
}

export function formatNumber(value: number | undefined, digits = 1, fallback = "—") {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return round(value, digits).toFixed(digits);
}
