"use client";

import { useMemo, useState, useCallback } from "react";
import type { IssueWithRelations } from "@/lib/db";
import type { Status } from "@prisma/client";
import * as api from "@/lib/api";

export function useIssues(initialIssues: IssueWithRelations[]) {
  const [issues, setIssues] = useState<IssueWithRelations[]>(initialIssues);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      open: issues.filter((i) => i.status === "open").length,
      in_progress: issues.filter((i) => i.status === "in_progress").length,
      resolved: issues.filter((i) => i.status === "resolved").length,
      critical: issues.filter(
        (i) => i.priority === "critical" && i.status !== "resolved"
      ).length,
    }),
    [issues]
  );

  const createIssue = useCallback(
    async (data: api.CreateIssuePayload): Promise<boolean> => {
      setMutating(true);
      setError(null);
      try {
        const created = await api.createIssue(data);
        setIssues((prev) => [created, ...prev]);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create issue");
        return false;
      } finally {
        setMutating(false);
      }
    },
    []
  );

  const updateStatus = useCallback(
    async (id: string, status: Status): Promise<void> => {
      const updated = await api.updateIssueStatus(id, status);
      setIssues((prev) => prev.map((i) => (i.id === id ? updated : i)));
    },
    []
  );

  const removeIssue = useCallback((id: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { issues, stats, mutating, error, createIssue, updateStatus, removeIssue };
}
