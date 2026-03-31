import type { HealthMetric, ReportBundle, ReportSummary, Workout } from "@/lib/domain/types";
import { buildSummary, calculateActivityTotals, formatNumber, selectLatestRides } from "@/lib/domain/metrics";

function section(title: string, lines: string[]) {
  return [`## ${title}`, ...lines].join("\n");
}

function renderSummaryLines(summary: ReportSummary) {
  const flags = summary.flags.length ? summary.flags.join(", ") : "нет";
  return [
    `- Период: ${summary.period}`,
    `- Тренировок: ${summary.totals.workouts}`,
    `- Объем: ${formatNumber(summary.totals.totalDistanceKm, 1)} км`,
    `- Время в движении: ${formatNumber(summary.totals.totalMovingHours, 1)} ч`,
    `- Набор высоты: ${formatNumber(summary.totals.totalElevationM, 0)} м`,
    `- Вес: ${formatNumber(summary.currentWeightKg, 1)} кг`,
    `- Изменение веса: ${formatNumber(summary.weightDeltaKg, 1)} кг`,
    `- Восстановление: сон ${formatNumber(summary.recovery.avgSleepMinutes7d, 0)} мин/7д, RHR ${formatNumber(summary.recovery.avgRestingHr7d, 0)}, baseline ${formatNumber(summary.recovery.baselineRestingHr28d, 0)}`,
    `- Флаги: ${flags}`
  ];
}

function renderRides(summary: ReportSummary) {
  if (!summary.latestRides.length) {
    return ["- Поездок пока нет."];
  }

  return summary.latestRides.map((ride) => {
    const hr = ride.avgHr ? `, пульс ${formatNumber(ride.avgHr, 0)}` : "";
    return `- ${ride.date.slice(0, 10)} | ${ride.name} | ${formatNumber(ride.distanceKm, 1)} км | ${formatNumber(ride.movingTimeMin, 0)} мин | ${formatNumber(ride.elevationM, 0)} м${hr}`;
  });
}

export function buildReportBundle(workouts: Workout[], metrics: HealthMetric[], generatedAt = new Date().toISOString()): ReportBundle {
  const daily = buildSummary({
    title: "Ежедневная сводка",
    period: "последние 24 часа",
    generatedAt,
    workouts,
    metrics,
    windowDays: 1
  });

  const weekly = buildSummary({
    title: "Еженедельная сводка",
    period: "последние 7 дней",
    generatedAt,
    workouts,
    metrics,
    windowDays: 7
  });

  const monthly = buildSummary({
    title: "Месячная сводка",
    period: "последние 30 дней",
    generatedAt,
    workouts,
    metrics,
    windowDays: 30
  });

  const jsonBlock = {
    generatedAt,
    daily,
    weekly,
    monthly,
    latestRides: selectLatestRides(workouts, 10),
    totals: calculateActivityTotals(workouts)
  };

  const latestMarkdown = [
    `# Отчет по активности`,
    `Сформирован: ${generatedAt}`,
    "",
    section("Сводка", renderSummaryLines(weekly)),
    "",
    section("Поездки", renderRides(weekly)),
    "",
    section("Нагрузка", [
      `- Неделя: ${formatNumber(weekly.totals.totalDistanceKm, 1)} км, ${formatNumber(weekly.totals.totalMovingHours, 1)} ч`,
      `- Месяц: ${formatNumber(monthly.totals.totalDistanceKm, 1)} км, ${formatNumber(monthly.totals.totalMovingHours, 1)} ч`
    ]),
    "",
    section("Восстановление", [
      `- Сон за 7 дней: ${formatNumber(weekly.recovery.avgSleepMinutes7d, 0)} мин`,
      `- Resting HR за 7 дней: ${formatNumber(weekly.recovery.avgRestingHr7d, 0)}`,
      `- Базовый resting HR за 28 дней: ${formatNumber(weekly.recovery.baselineRestingHr28d, 0)}`
    ]),
    "",
    section("Вес", [
      `- Текущий вес: ${formatNumber(weekly.currentWeightKg, 1)} кг`,
      `- Дельта за 7 дней: ${formatNumber(weekly.weightDeltaKg, 1)} кг`
    ]),
    "",
    section("Флаги", weekly.flags.length ? weekly.flags.map((flag) => `- ${flag}`) : ["- Нет тревожных флагов"]),
    "",
    "## JSON",
    "```json",
    JSON.stringify(jsonBlock, null, 2),
    "```"
  ].join("\n");

  return {
    daily,
    weekly,
    monthly,
    latestMarkdown,
    generatedAt
  };
}
