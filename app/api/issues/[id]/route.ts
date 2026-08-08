import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getIssueById, updateIssueStatus, deleteIssue } from "@/lib/db";
import { updateStatusSchema } from "@/lib/validation";
import { emitIssueEvent } from "@/lib/events";
import { errorResponse, zodErrorResponse, prismaErrorResponse } from "@/lib/apiErrors";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = updateStatusSchema.safeParse(body);
  if (!result.success) {
    return zodErrorResponse(result.error);
  }

  try {
    const issue = await updateIssueStatus(id, result.data.status);
    emitIssueEvent({ type: "updated", issue });
    return NextResponse.json(issue);
  } catch (e) {
    // P2025 -> 404; anything else (e.g. DB down) surfaces as a real 500
    // instead of being mislabeled "Issue not found".
    const mapped = prismaErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;
  const issue = await getIssueById(id);
  if (!issue) {
    return errorResponse("Issue not found", 404);
  }

  const canDelete =
    session.user.role === "ADMIN" || issue.reporterId === session.user.id;
  if (!canDelete) {
    return errorResponse("Forbidden", 403);
  }

  try {
    await deleteIssue(id);
  } catch (e) {
    // TOCTOU: a concurrent delete already removed the row. DELETE is
    // idempotent, so report success rather than an unhandled 500.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ ok: true });
    }
    throw e;
  }

  emitIssueEvent({ type: "deleted", id });
  return NextResponse.json({ ok: true });
}
