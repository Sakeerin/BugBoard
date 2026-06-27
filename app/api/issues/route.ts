import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getIssues, getIssueStats, createIssue } from "@/lib/db";
import { createIssueSchema } from "@/lib/validation";
import { emitIssueEvent } from "@/lib/events";
import type { Priority, Status } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as Status | null;
  const priority = searchParams.get("priority") as Priority | null;
  const search = searchParams.get("search") ?? undefined;

  const [issues, stats] = await Promise.all([
    getIssues({
      ...(status && { status }),
      ...(priority && { priority }),
      search,
    }),
    getIssueStats(),
  ]);

  return NextResponse.json({ issues, stats });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = createIssueSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten() },
      { status: 400 }
    );
  }

  const issue = await createIssue(result.data, session.user.id);
  emitIssueEvent({ type: "created", issue });
  return NextResponse.json(issue, { status: 201 });
}
