"use client";

import { useState } from "react";
import type { Session } from "next-auth";
import type { IssueWithRelations, IssueStats, UserSummary } from "@/lib/db";
import type { Status, Priority } from "@prisma/client";
import { useIssues } from "@/hooks/useIssues";
import UserMenu from "@/components/UserMenu";
import IssueCard from "@/components/IssueCard";
import CreateIssueModal from "@/components/CreateIssueModal";
import * as api from "@/lib/api";

const statusOptions: Array<{ label: string; value: Status | "all" }> = [
  { label: "All Status", value: "all" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
];

const priorityOptions: Array<{ label: string; value: Priority | "all" }> = [
  { label: "All Priority", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

interface Props {
  initialIssues: IssueWithRelations[];
  initialStats: IssueStats;
  session: Session;
  users: UserSummary[];
}

export default function Dashboard({
  initialIssues,
  session,
  users,
}: Props) {
  const { issues, stats, mutating, error, createIssue, updateStatus, removeIssue } =
    useIssues(initialIssues);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = issues.filter((issue) => {
    if (statusFilter !== "all" && issue.status !== statusFilter) return false;
    if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !issue.title.toLowerCase().includes(q) &&
        !issue.description.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  async function handleDelete(id: string) {
    setDeleteError(null);
    try {
      await api.deleteIssue(id);
      removeIssue(id);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteConfirm(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BugBoard</h1>
          <p className="text-xs text-gray-400">Mini issue tracker</p>
        </div>
        <UserMenu session={session} />
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={stats.open} color="text-blue-600" />
        <StatCard label="In Progress" value={stats.in_progress} color="text-yellow-600" />
        <StatCard label="Resolved" value={stats.resolved} color="text-green-600" />
        <StatCard label="Critical" value={stats.critical} color="text-red-600" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search issues…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as Priority | "all")
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {priorityOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New Issue
        </button>
      </div>

      {/* Error banners */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Issue list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
          {issues.length === 0
            ? "No issues yet — create one to get started."
            : "No issues match the current filters."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              session={session}
              onUpdateStatus={updateStatus}
              onDelete={(id) => setDeleteConfirm(id)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateIssueModal
          users={users}
          onClose={() => setShowCreate(false)}
          onCreate={createIssue}
        />
      )}

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Delete this issue?
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              This action is permanent and cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {mutating && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white shadow-lg">
          Saving…
        </div>
      )}
    </div>
  );
}
