import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getIssues, getIssueStats, createIssue } from "@/lib/db";
import { createIssueSchema, listQuerySchema } from "@/lib/validation";
import { emitIssueEvent } from "@/lib/events";
import { errorResponse, zodErrorResponse, prismaErrorResponse } from "@/lib/apiErrors";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const [issues, stats] = await Promise.all([
    getIssues(parsed.data),
    getIssueStats(),
  ]);

  return NextResponse.json({ issues, stats });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  const result = createIssueSchema.safeParse(body);
  if (!result.success) {
    return zodErrorResponse(result.error);
  }

  try {
    const issue = await createIssue(result.data, session.user.id);
    emitIssueEvent({ type: "created", issue });
    return NextResponse.json(issue, { status: 201 });
  } catch (e) {
    // e.g. a well-formed but nonexistent assigneeId -> FK error -> 400, not 500
    const mapped = prismaErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
