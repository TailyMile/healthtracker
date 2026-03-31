import { getLatestPersistedReportBundle, getReportDocument } from "@/lib/reports";
import { jsonError, jsonOk, toErrorMessage } from "@/lib/utils/api";

export const runtime = "nodejs";

function filename(kind: string, format: string) {
  return `${kind}_summary.${format}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = (url.searchParams.get("kind") ?? url.searchParams.get("type") ?? "latest") as "daily" | "weekly" | "monthly" | "latest";
    const format = (url.searchParams.get("format") ?? "md").toLowerCase();

    if (format !== "md" && format !== "json") {
      return jsonError("format must be md or json", 400);
    }

    if (format === "md" && kind !== "latest") {
      return jsonError("markdown download is available only for latest report", 400);
    }

    if (kind === "latest") {
      const bundle = await getLatestPersistedReportBundle();
      if (!bundle) {
        return jsonError("report not found", 404);
      }

      if (format === "md") {
        return jsonOk({
          kind,
          format,
          filename: "latest_chatgpt_report.md",
          contentType: "text/markdown; charset=utf-8",
          content: bundle.latestMarkdown
        });
      }

      return jsonOk({
        kind,
        format,
        filename: "latest_chatgpt_report.json",
        contentType: "application/json; charset=utf-8",
        content: JSON.stringify(bundle, null, 2)
      });
    }

    const report = await getReportDocument(kind);
    if (!report) {
      return jsonError("report not found", 404);
    }

    if (format === "json") {
      return jsonOk({
        kind,
        format,
        filename: filename(kind, "json"),
        contentType: "application/json; charset=utf-8",
        content: JSON.stringify(report.summary, null, 2)
      });
    }

    return jsonOk({
      kind,
      format,
      filename: filename(kind, "md"),
      contentType: "text/markdown; charset=utf-8",
      content: report.markdown
    });
  } catch (error) {
    return jsonError(toErrorMessage(error), 500);
  }
}
