import { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/domain/types";

export function jsonOk<T>(data: T, status = 200) {
  const payload: ApiSuccess<T> = { ok: true, data };
  return NextResponse.json(payload, { status });
}

export function jsonError(error: string, status = 400) {
  const payload: ApiFailure = { ok: false, error };
  return NextResponse.json(payload, { status });
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
