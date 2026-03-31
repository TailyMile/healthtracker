import type { HealthMetric } from "@/lib/domain/types";
import { parseAppleDate } from "./date";

function createMetric(
  type: HealthMetric["type"],
  value: number,
  observedAt: string,
  unit?: string,
  raw?: Record<string, unknown>
): HealthMetric {
  return {
    source: "apple_health",
    type,
    value,
    unit,
    observedAt,
    raw
  };
}

function isTruthySleepValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.includes("asleep") || normalized.includes("inbed");
}

function safeNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function unitToKg(value: number, unit?: string) {
  const normalized = unit?.trim().toLowerCase();
  if (normalized === "lb" || normalized === "pound" || normalized === "pounds") {
    return value * 0.45359237;
  }
  return value;
}

function caloriesValueToKcal(value: number, unit?: string) {
  const normalized = unit?.trim().toLowerCase();
  if (normalized === "kj") {
    return value * 0.239005736;
  }
  return value;
}

export interface AppleHealthRecordLike {
  type: string;
  value?: string;
  unit?: string;
  startDate?: string;
  endDate?: string;
  sourceName?: string;
  device?: string;
  metadata?: Record<string, unknown>;
}

export function normalizeAppleHealthRecord(record: AppleHealthRecordLike): HealthMetric[] {
  const observedAt = record.endDate ?? record.startDate;
  if (!observedAt) {
    return [];
  }

  const timestamp = parseAppleDate(observedAt).toISOString();
  const raw = {
    type: record.type,
    value: record.value,
    unit: record.unit,
    startDate: record.startDate,
    endDate: record.endDate,
    sourceName: record.sourceName,
    device: record.device,
    metadata: record.metadata
  };

  const numeric = safeNumber(record.value);
  const type = record.type;

  if (type === "HKQuantityTypeIdentifierBodyMass" || type === "HKQuantityTypeIdentifierWeight") {
    if (numeric === null) {
      return [];
    }
    return [createMetric("weight", unitToKg(numeric, record.unit), timestamp, "kg", raw)];
  }

  if (type === "HKQuantityTypeIdentifierBodyFatPercentage") {
    if (numeric === null) {
      return [];
    }
    const pct = record.unit?.includes("%") ? numeric : numeric;
    return [createMetric("body_fat_pct", pct, timestamp, "%", raw)];
  }

  if (type === "HKQuantityTypeIdentifierHeartRate") {
    if (numeric === null) {
      return [];
    }
    return [createMetric("heart_rate", numeric, timestamp, "bpm", raw)];
  }

  if (type === "HKQuantityTypeIdentifierRestingHeartRate") {
    if (numeric === null) {
      return [];
    }
    return [createMetric("resting_hr", numeric, timestamp, "bpm", raw)];
  }

  if (type === "HKQuantityTypeIdentifierStepCount") {
    if (numeric === null) {
      return [];
    }
    return [createMetric("steps", numeric, timestamp, "steps", raw)];
  }

  if (type === "HKQuantityTypeIdentifierActiveEnergyBurned" || type === "HKQuantityTypeIdentifierBasalEnergyBurned") {
    if (numeric === null) {
      return [];
    }
    return [createMetric("calories", caloriesValueToKcal(numeric, record.unit), timestamp, "kcal", raw)];
  }

  if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
    if (!record.value || !isTruthySleepValue(record.value)) {
      return [];
    }
    if (!record.startDate || !record.endDate) {
      return [];
    }
    const minutes = (parseAppleDate(record.endDate).getTime() - parseAppleDate(record.startDate).getTime()) / 60000;
    if (minutes <= 0) {
      return [];
    }
    return [createMetric("sleep_minutes", minutes, timestamp, "min", raw)];
  }

  return [];
}
