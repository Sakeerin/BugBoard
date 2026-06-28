"use client";

import { useState } from "react";
import type { UserSummary } from "@/lib/db";
import type { CreateIssuePayload } from "@/lib/api";
import { createIssueSchema } from "@/lib/validation";
import { Priority } from "@prisma/client";

interface Props {
  users: UserSummary[];
  onClose: () => void;
  onCreated: () => void;
  onCreate: (data: CreateIssuePayload) => Promise<boolean>;
}

type FieldErrors = Partial<Record<"title" | "description", string>>;

const priorityOptions: Priority[] = ["low", "medium", "high", "critical"];

export default function CreateIssueModal({ users, onClose, onCreated, onCreate }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const data = new FormData(e.currentTarget);
    const payload = {
      title: String(data.get("title") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      priority: data.get("priority") as Priority,
      assigneeId: (data.get("assigneeId") as string) || undefined,
    };

    const parsed = createIssueSchema.safeParse(payload);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        title: flat.title?.[0],
        description: flat.description?.[0],
      });
      return;
    }

    setSubmitting(true);
    const ok = await onCreate(parsed.data);
    setSubmitting(false);

    if (ok) {
      onCreated();
    } else {
      setServerError("Failed to create issue. Please try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">New Issue</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              name="title"
              type="text"
              maxLength={200}
              placeholder="Short summary of the issue"
              onChange={() => setFieldErrors((p) => ({ ...p, title: undefined }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.title ? "border-red-400" : "border-gray-300"
              }`}
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder="Steps to reproduce, expected vs actual behaviour…"
              onChange={() => setFieldErrors((p) => ({ ...p, description: undefined }))}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.description ? "border-red-400" : "border-gray-300"
              }`}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Priority
              </label>
              <select
                name="priority"
                defaultValue="medium"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Assignee (optional)
              </label>
              <select
                name="assigneeId"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {serverError && (
            <p className="text-sm text-red-600">{serverError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create Issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
