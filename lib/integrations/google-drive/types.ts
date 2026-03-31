export interface GoogleDriveTokenState {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}

export interface GoogleDriveUploadResult {
  id: string;
  name?: string;
  webViewLink?: string;
}

export interface ReportUploadPayload {
  markdown: string;
  reportJson: unknown;
  reportName: string;
  generatedAt: string;
}
