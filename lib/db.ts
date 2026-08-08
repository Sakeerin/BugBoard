import { Priority, Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type { Priority, Status };

const issueSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  reporterId: true,
  assigneeId: true,
  reporter: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
} as const;

export type IssueWithRelations = Awaited<
  ReturnType<typeof getIssueById>
> extends infer T
  ? NonNullable<T>
  : never;

export interface IssueFilters {
  status?: Status;
  priority?: Priority;
  search?: string;
}

export interface IssueStats {
  open: number;
  in_progress: number;
  resolved: number;
  critical: number;
}

export interface CreateIssueInput {
  title: string;
  description: string;
  priority: Priority;
  assigneeId?: string;
}

export async function getIssues(filters?: IssueFilters) {
  return prisma.issue.findMany({
    where: {
      ...(filters?.status && { status: filters.status }),
      ...(filters?.priority && { priority: filters.priority }),
      ...(filters?.search && {
        OR: [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
        ],
      }),
    },
    select: issueSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getIssueById(id: string) {
  return prisma.issue.findUnique({
    where: { id },
    select: issueSelect,
  });
}

export async function getIssueStats(): Promise<IssueStats> {
  // One grouped query for the per-status counts + one for the "active critical"
  // metric (which spans statuses), instead of four separate COUNT queries.
  const [byStatus, critical] = await Promise.all([
    prisma.issue.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.issue.count({
      where: { priority: "critical", status: { not: "resolved" } },
    }),
  ]);

  const counts: Record<Status, number> = {
    open: 0,
    in_progress: 0,
    resolved: 0,
  };
  for (const row of byStatus) counts[row.status] = row._count._all;

  return {
    open: counts.open,
    in_progress: counts.in_progress,
    resolved: counts.resolved,
    critical,
  };
}

export async function createIssue(data: CreateIssueInput, reporterId: string) {
  return prisma.issue.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      reporterId,
      ...(data.assigneeId && { assigneeId: data.assigneeId }),
    },
    select: issueSelect,
  });
}

export async function updateIssueStatus(id: string, status: Status) {
  return prisma.issue.update({
    where: { id },
    data: { status },
    select: issueSelect,
  });
}

export async function deleteIssue(id: string): Promise<void> {
  await prisma.issue.delete({ where: { id } });
}

export async function getUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export type UserSummary = Awaited<ReturnType<typeof getUsers>>[number];
