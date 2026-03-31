import { NextRequest } from "next/server";
import { getOAuthToken, saveOAuthToken } from "@/lib/db";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";
import { uploadLatestReportBundle } from "@/lib/integrations/google-drive/client";
import { refreshGoogleDriveToken } from "@/lib/integrations/google-drive/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadLatestReport(request: NextRequest) {
  const response = await fetch(new URL("/api/reports/latest", request.url), { cache: "no-store" });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || "Failed to load latest report");
  }
  return json.data as {
    latestMarkdown: string;
    generatedAt: string;
    daily?: unknown;
    weekly?: unknown;
    monthly?: unknown;
  };
}

export async function POST(request: NextRequest) {
  try {
    const tokens = await getOAuthToken("google");
    if (!tokens) {
      return jsonError("Google Drive is not connected. Open /api/drive/connect first.", 401);
    }

    const report = await loadLatestReport(request);
    let currentTokens = tokens;

    try {
      if (currentTokens.expiresAt <= Date.now() + 30_000 && currentTokens.refreshToken) {
        const refreshed = await refreshGoogleDriveToken(currentTokens.refreshToken);
        currentTokens = {
          provider: "google",
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? currentTokens.refreshToken,
          expiresAt: refreshed.expiresAt,
          scope: refreshed.scope,
          tokenType: refreshed.tokenType
        };
      }

      const uploaded = await uploadLatestReportBundle(currentTokens, {
        markdown: report.latestMarkdown,
        reportJson: {
          generatedAt: report.generatedAt,
          daily: report.daily,
          weekly: report.weekly,
          monthly: report.monthly,
        },
        reportName: "latest_chatgpt_report",
        generatedAt: report.generatedAt,
      });

      await saveOAuthToken({
        provider: "google",
        accessToken: currentTokens.accessToken,
        refreshToken: currentTokens.refreshToken,
        expiresAt: currentTokens.expiresAt,
        scope: currentTokens.scope,
        tokenType: currentTokens.tokenType
      });

      return jsonOk({ uploaded, message: "Report uploaded to Google Drive" });
    } catch (error) {
      return jsonError(toErrorMessage(error), 500);
    }
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
