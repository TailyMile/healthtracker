const APPLE_DATE_PATTERNS = [
  /^(?<date>\d{4}-\d{2}-\d{2})\s(?<time>\d{2}:\d{2}:\d{2})(?:\s(?<zone>Z|[+-]\d{4}|[+-]\d{2}:?\d{2}))?$/,
  /^(?<date>\d{4}-\d{2}-\d{2})T(?<time>\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(?<zone>Z|[+-]\d{2}:?\d{2})?$/
];

function normalizeZone(zone?: string) {
  if (!zone || zone === "Z") {
    return "Z";
  }

  if (/^[+-]\d{4}$/.test(zone)) {
    return `${zone.slice(0, 3)}:${zone.slice(3)}`;
  }

  if (/^[+-]\d{2}\d{2}$/.test(zone)) {
    return `${zone.slice(0, 3)}:${zone.slice(3)}`;
  }

  return zone;
}

export function parseAppleDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Apple date value is empty");
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  for (const pattern of APPLE_DATE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match?.groups) {
      continue;
    }

    const zone = normalizeZone(match.groups.zone);
    const iso = `${match.groups.date}T${match.groups.time}${zone ?? "Z"}`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const epoch = Date.parse(trimmed.replace(" ", "T"));
  if (!Number.isNaN(epoch)) {
    return new Date(epoch);
  }

  throw new Error(`Unable to parse Apple date: ${value}`);
}

export function toIsoString(value: string | Date): string {
  return parseAppleDate(value).toISOString();
}
