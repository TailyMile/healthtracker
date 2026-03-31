import type { HealthMetric } from "@/lib/domain/types";

export interface AppleHealthParseResult {
  metrics: HealthMetric[];
  workouts: Array<Record<string, unknown>>;
  sourceKind: string;
  warnings: string[];
}

export interface RawAppleHealthRecord {
  type?: string;
  value?: string;
  unit?: string;
  startDate?: string;
  endDate?: string;
  sourceName?: string;
  device?: string;
  metadata?: Record<string, unknown>;
}
