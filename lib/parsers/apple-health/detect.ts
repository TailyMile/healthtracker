export type AppleHealthFileKind = "xml" | "csv" | "json" | "zip";

export function detectAppleHealthFileKind(fileName: string, mimeType?: string): AppleHealthFileKind {
  const lowered = fileName.toLowerCase();
  const normalizedMime = mimeType?.toLowerCase() ?? "";

  if (lowered.endsWith(".zip") || normalizedMime.includes("zip")) {
    return "zip";
  }

  if (lowered.endsWith(".csv") || normalizedMime.includes("csv")) {
    return "csv";
  }

  if (lowered.endsWith(".json") || normalizedMime.includes("json")) {
    return "json";
  }

  return "xml";
}
