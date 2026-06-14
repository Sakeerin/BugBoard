import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getIssueById, updateIssueStatus, deleteIssue } from "@/lib/db";
import { updateStatusSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = updateStatusSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const issue = await updateIssueStatus(id, result.data.status);
    return NextResponse.json(issue);
  } catch {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const issue = await getIssueById(id);
  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const canDelete =
    session.user.role === "ADMIN" || issue.reporterId === session.user.id;
  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteIssue(id);
  return NextResponse.json({ ok: true });
}
