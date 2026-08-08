import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

/**
 * All API routes return errors in a single shape: `{ error: string }`. The
 * client (lib/api.ts) reads `body.error` directly, so keeping this consistent
 * avoids the "[object Object]" bug that arises when a route returns a
 * structured error (e.g. a raw zod flatten) instead of a message string.
 */
export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** 400 with the validation messages joined into a readable string. */
export function zodErrorResponse(error: ZodError) {
  const message =
    error.issues.map((i) => i.message).join(", ") || "Invalid request";
  return errorResponse(message, 400);
}

/**
 * Map a thrown Prisma error to an appropriate HTTP response. Returns null for
 * anything unrecognized so the caller can rethrow and let the framework surface
 * a 500 — rather than silently masking real failures (e.g. DB down) as 404s.
 */
export function prismaErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2025": // record required but not found
        return errorResponse("Issue not found", 404);
      case "P2003": // foreign key constraint failed (e.g. unknown assigneeId)
        return errorResponse("Unknown assignee", 400);
    }
  }
  return null;
}
