import type { HealthMetricType } from "@/lib/domain/types";
import { getOAuthToken, getSyncState, listHealthMetrics, listWorkouts } from "@/lib/db";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";

export const runtime = "nodejs";

const HEALTH_TYPES: HealthMetricType[] = [
  "weight",
  "body_fat_pct",
  "heart_rate",
  "resting_hr",
  "steps",
  "sleep_minutes",
  "calories"
];

const HEALTH_RECOVERY_CORE: HealthMetricType[] = ["weight", "resting_hr", "sleep_minutes"];

function latestDate(values: Array<{ observedAt?: string; startedAt?: string }>) {
  const dates = values
    .map((item) => item.observedAt ?? item.startedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a));
  return dates[0];
}

function recommend(params: {
  workouts: number;
  healthCounts: Record<HealthMetricType, number>;
}) {
  const hasWorkouts = params.workouts > 0;
  const hasAnyHealth = HEALTH_TYPES.some((type) => params.healthCounts[type] > 0);
  const hasRecoveryCore = HEALTH_RECOVERY_CORE.every((type) => params.healthCounts[type] > 0);
  const healthCoverageRatio = HEALTH_TYPES.filter((type) => params.healthCounts[type] > 0).length / HEALTH_TYPES.length;

  const needsStrava = !hasWorkouts;
  const needsAppleHealth = !hasRecoveryCore;

  if (needsStrava && !hasAnyHealth) {
    return {
      needsStrava: true,
      needsAppleHealth: true,
      verdict: "Данных пока нет — подключите оба источника.",
      details: "Strava даст тренировки, Apple Health закроет вес, сон, resting HR и шаги."
    };
  }

  if (needsStrava) {
    return {
      needsStrava: true,
      needsAppleHealth: false,
      verdict: "Для анализа тренировочной нагрузки нужен Strava.",
      details: "Apple Health уже полезен для восстановления, но без поездок Strava не хватает данных по дистанции/времени."
    };
  }

  if (needsAppleHealth) {
    return {
      needsStrava: false,
      needsAppleHealth: true,
      verdict: "Для веса и восстановления стоит добавить Apple Health.",
      details: "Strava покрывает тренировки, но без Apple Health отчёт по восстановлению и весу неполный."
    };
  }

  return {
    needsStrava: false,
    needsAppleHealth: false,
    verdict: "Оптимально: держать и Strava, и Apple Health.",
    details: healthCoverageRatio >= 0.7
      ? "Покрытие метрик хорошее: оба источника нужны и дополняют друг друга."
      : "Strava уже достаточно для нагрузки, но Apple Health стоит расширить для более точных выводов по восстановлению."
  };
}

export async function GET() {
  try {
    const [metrics, workouts, stravaToken, googleToken, stravaSync] = await Promise.all([
      listHealthMetrics(),
      listWorkouts(),
      getOAuthToken("strava"),
      getOAuthToken("google"),
      getSyncState("strava")
    ]);

    const healthCounts = HEALTH_TYPES.reduce<Record<HealthMetricType, number>>((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {} as Record<HealthMetricType, number>);

    for (const metric of metrics) {
      healthCounts[metric.type] += 1;
    }

    const recommendation = recommend({
      workouts: workouts.length,
      healthCounts
    });

    const hasDriveToken = Boolean(googleToken?.accessToken);
    const hasStravaToken = Boolean(stravaToken?.accessToken);

    return jsonOk({
      strava: {
        connected: hasStravaToken,
        expiresAt: stravaToken?.expiresAt,
        lastSyncAt: stravaSync?.lastSyncAt ?? null,
        workouts: workouts.length,
        latestWorkoutAt: latestDate(workouts),
      },
      drive: {
        connected: hasDriveToken,
        expiresAt: googleToken?.expiresAt,
      },
      appleHealth: {
        metrics: metrics.length,
        latestMetricAt: latestDate(metrics),
        types: HEALTH_TYPES.map((type) => ({ type, count: healthCounts[type] }))
      },
      recommendation
    });
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
