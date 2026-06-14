import type { IssueWithRelations, IssueStats } from "@/lib/db";
import type { Status, Priority } from "@prisma/client";

export type { IssueWithRelations, IssueStats };

export interface IssueListResponse {
  issues: IssueWithRelations[];
  stats: IssueStats;
}

export interface IssueFilters {
  status?: Status | "all";
  priority?: Priority | "all";
  search?: string;
}

export interface CreateIssuePayload {
  title: string;
  description: string;
  priority: Priority;
  assigneeId?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function fetchIssues(filters?: IssueFilters): Promise<IssueListResponse> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.priority && filters.priority !== "all") params.set("priority", filters.priority);
  if (filters?.search) params.set("search", filters.search);
  const qs = params.toString();
  return request<IssueListResponse>(`/api/issues${qs ? `?${qs}` : ""}`);
}

export function createIssue(data: CreateIssuePayload): Promise<IssueWithRelations> {
  return request<IssueWithRelations>("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateIssueStatus(
  id: string,
  status: Status
): Promise<IssueWithRelations> {
  return request<IssueWithRelations>(`/api/issues/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function deleteIssue(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/issues/${id}`, { method: "DELETE" });
}
