import { ensureGoogleEnv } from "@/lib/config";
import type { GoogleDriveTokenState, GoogleDriveUploadResult, ReportUploadPayload } from "./types";
import { refreshGoogleDriveToken } from "./oauth";

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

async function ensureAccessToken(tokens: GoogleDriveTokenState) {
  if (tokens.expiresAt > Date.now() + 30_000) {
    return tokens;
  }
  if (!tokens.refreshToken) {
    throw new Error("Google Drive token expired and no refresh token is available");
  }
  return refreshGoogleDriveToken(tokens.refreshToken);
}

function buildMultipartBody(filename: string, contentType: string, data: string, parents: string[]) {
  const boundary = `healthtracker-${crypto.randomUUID()}`;
  const metadata = {
    name: filename,
    mimeType: contentType,
    ...(parents.length ? { parents } : {}),
  };

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset="UTF-8"',
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${contentType}; charset=UTF-8`,
    "",
    data,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return { boundary, body };
}

async function uploadFile(tokens: GoogleDriveTokenState, payload: { filename: string; mimeType: string; data: string; parents: string[] }): Promise<GoogleDriveUploadResult> {
  const access = await ensureAccessToken(tokens);
  const { boundary, body } = buildMultipartBody(payload.filename, payload.mimeType, payload.data, payload.parents);
  const response = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive upload failed: ${errorText}`);
  }

  return (await response.json()) as GoogleDriveUploadResult;
}

export async function uploadLatestReportBundle(tokens: GoogleDriveTokenState, payload: ReportUploadPayload): Promise<{ markdown: GoogleDriveUploadResult; json: GoogleDriveUploadResult }> {
  const { folderId } = ensureGoogleEnv();
  const parents = folderId ? [folderId] : [];
  const stamp = payload.generatedAt.slice(0, 19).replace(/[:T]/g, "-");

  const markdown = await uploadFile(tokens, {
    filename: `${payload.reportName}-${stamp}.md`,
    mimeType: "text/markdown",
    data: payload.markdown,
    parents,
  });

  const json = await uploadFile(tokens, {
    filename: `${payload.reportName}-${stamp}.json`,
    mimeType: "application/json",
    data: JSON.stringify(payload.reportJson, null, 2),
    parents,
  });

  return { markdown, json };
}
