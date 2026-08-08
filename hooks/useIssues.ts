"use client";

import { useMemo, useState, useCallback } from "react";
import type { IssueWithRelations } from "@/lib/db";
import type { IssueEvent } from "@/lib/events";
import type { Status } from "@prisma/client";
import * as api from "@/lib/api";
import { useIssueStream } from "@/hooks/useIssueStream";

/**
 * Replace the matching issue with `incoming`, but only if `incoming` is at
 * least as recent as what we already hold. Guards against a stale HTTP response
 * (or an out-of-order frame) clobbering a newer state that already arrived via
 * SSE. updatedAt is an ISO string at runtime, so compare parsed timestamps.
 */
function reconcile(
  list: IssueWithRelations[],
  incoming: IssueWithRelations
): IssueWithRelations[] {
  return list.map((i) => {
    if (i.id !== incoming.id) return i;
    return new Date(i.updatedAt) > new Date(incoming.updatedAt) ? i : incoming;
  });
}

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

  const applyEvent = useCallback((e: IssueEvent) => {
    setIssues((prev) => {
      switch (e.type) {
        case "created":
          // Dedupe: skip if already present (optimistic update from this tab)
          if (prev.some((i) => i.id === e.issue.id)) return prev;
          return [e.issue, ...prev];
        case "updated":
          // If we don't have it yet (e.g. created during a disconnect gap and
          // missed), insert it so a later 'updated' can't silently vanish.
          if (!prev.some((i) => i.id === e.issue.id)) return [e.issue, ...prev];
          return reconcile(prev, e.issue);
        case "deleted":
          return prev.filter((i) => i.id !== e.id);
      }
    });
  }, []);

  // Refetch the whole list to recover events missed while disconnected.
  const resync = useCallback(async () => {
    try {
      const { issues: fresh } = await api.fetchIssues();
      setIssues(fresh);
    } catch {
      // A failure here is non-fatal; the next reconnect will resync again.
      // A terminal auth failure is handled separately by onFatal.
    }
  }, []);

  useIssueStream({
    onEvent: applyEvent,
    onOpen: resync,
    onFatal: () => {
      // Stream refused (session likely expired) and won't auto-reconnect.
      // A full-page reload is intentional here: it clears all client state and
      // the dead EventSource, and lets middleware re-run the auth redirect —
      // a soft router.push() would keep the broken realtime state around.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    },
  });

  const createIssue = useCallback(
    async (data: api.CreateIssuePayload): Promise<boolean> => {
      setMutating(true);
      setError(null);
      try {
        const created = await api.createIssue(data);
        // SSE fires before the HTTP response returns, so the event may have
        // already added this issue. Guard to avoid a duplicate.
        setIssues((prev) =>
          prev.some((i) => i.id === created.id) ? prev : [created, ...prev]
        );
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
      setMutating(true);
      setError(null);
      try {
        const updated = await api.updateIssueStatus(id, status);
        // Reconcile by recency: a newer 'updated' SSE frame may already have
        // been applied while this request was in flight.
        setIssues((prev) => reconcile(prev, updated));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update issue");
        throw e; // let the caller surface a toast
      } finally {
        setMutating(false);
      }
    },
    []
  );

  const removeIssue = useCallback((id: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return {
    issues,
    stats,
    mutating,
    error,
    createIssue,
    updateStatus,
    removeIssue,
  };
}
