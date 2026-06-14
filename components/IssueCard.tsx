"use client";

import type { IssueWithRelations } from "@/lib/db";
import type { Status } from "@prisma/client";
import type { Session } from "next-auth";

const priorityStyles: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const statusStyles: Record<string, string> = {
  open: "bg-sky-100 text-sky-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
};

const nextStatus: Record<Status, { label: string; value: Status } | null> = {
  open: { label: "Start", value: "in_progress" },
  in_progress: { label: "Resolve", value: "resolved" },
  resolved: { label: "Reopen", value: "open" },
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface Props {
  issue: IssueWithRelations;
  session: Session;
  onUpdateStatus: (id: string, status: Status) => Promise<void>;
  onDelete: (id: string) => void;
}

export default function IssueCard({
  issue,
  session,
  onUpdateStatus,
  onDelete,
}: Props) {
  const canDelete =
    session.user.role === "ADMIN" ||
    issue.reporterId === session.user.id;

  const transition = nextStatus[issue.status];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {issue.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">
            {issue.description}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[issue.priority]}`}
          >
            {issue.priority}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[issue.status]}`}
          >
            {issue.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <span>
            By <span className="font-medium text-gray-600">{issue.reporter.name}</span>
          </span>
          {issue.assignee && (
            <span>
              → <span className="font-medium text-gray-600">{issue.assignee.name}</span>
            </span>
          )}
          <span>{formatDate(issue.createdAt)}</span>
        </div>

        <div className="flex gap-2">
          {transition && (
            <button
              onClick={() => onUpdateStatus(issue.id, transition.value)}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              {transition.label}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(issue.id)}
              className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
