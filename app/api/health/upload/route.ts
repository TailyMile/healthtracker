import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

const allowedContentTypes = [
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "application/xml",
  "text/xml",
  "text/csv",
  "application/json",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("imports/apple-health/")) {
          throw new Error("Invalid upload pathname.");
        }

        return {
          allowedContentTypes,
          maximumSizeInBytes: 1024 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
      onUploadCompleted: async () => {
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to handle upload" },
      { status: 400 },
    );
  }
}
