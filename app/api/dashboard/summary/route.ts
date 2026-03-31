import { getDashboardSummary } from "@/lib/reports";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const summary = await getDashboardSummary();
    return jsonOk({
      workouts: summary.totals.workouts,
      totalDistanceKm: summary.totals.totalDistanceKm,
      totalMovingHours: summary.totals.totalMovingHours,
      currentWeightKg: summary.currentWeightKg,
      latestRides: summary.latestRides,
      reportGeneratedAt: summary.reportGeneratedAt,
      reportCount: summary.reportCount,
      lastUpdatedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
