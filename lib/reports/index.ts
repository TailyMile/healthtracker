import type { HealthMetric, ReportBundle, Workout } from "@/lib/domain/types";
import { calculateActivityTotals, getLatestWeight, selectLatestRides } from "@/lib/domain/metrics";
import {
  getAllWorkoutsAndMetrics,
  getLatestReportBundle,
  saveReport,
  listReports
} from "@/lib/db";
import { buildReportBundle } from "@/lib/reports/generate";

export interface DashboardSummary {
  totals: ReturnType<typeof calculateActivityTotals>;
  currentWeightKg?: number;
  latestRides: ReturnType<typeof selectLatestRides>;
  reportGeneratedAt?: string;
  reportCount: number;
}

export async function generateReportBundleFromDb() {
  const { workouts, metrics } = await getAllWorkoutsAndMetrics();
  return buildReportBundle(workouts, metrics);
}

export async function persistReportBundle(bundle: ReportBundle) {
  await saveReport("daily", bundle.generatedAt, bundle.daily, "");
  await saveReport("weekly", bundle.generatedAt, bundle.weekly, "");
  await saveReport("monthly", bundle.generatedAt, bundle.monthly, "");
  await saveReport("latest", bundle.generatedAt, bundle, bundle.latestMarkdown);
  return bundle;
}

export async function generateAndSaveReportBundle() {
  const bundle = await generateReportBundleFromDb();
  await persistReportBundle(bundle);
  return bundle;
}

export async function getLatestPersistedReportBundle() {
  return getLatestReportBundle();
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { workouts, metrics } = await getAllWorkoutsAndMetrics();
  const reports = await listReports();
  return {
    totals: calculateActivityTotals(workouts),
    currentWeightKg: getLatestWeight(metrics),
    latestRides: selectLatestRides(workouts, 5),
    reportGeneratedAt: reports.find((report) => report.kind === "latest")?.generatedAt,
    reportCount: reports.length
  };
}

export async function getReportDocument(kind: "daily" | "weekly" | "monthly" | "latest") {
  if (kind === "latest") {
    const bundle = await getLatestPersistedReportBundle();
    if (!bundle) {
      return null;
    }
    return {
      kind,
      generatedAt: bundle.generatedAt,
      summary: bundle,
      markdown: bundle.latestMarkdown
    };
  }

  const reports = await listReports();
  const report = reports.find((item) => item.kind === kind);
  if (!report) {
    return null;
  }

  return {
    kind,
    generatedAt: report.generatedAt,
    summary: JSON.parse(report.summaryJson) as HealthMetric | Workout | Record<string, unknown>,
    markdown: report.markdown
  };
}
