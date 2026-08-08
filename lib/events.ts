import EventEmitter from "events";
import type { IssueWithRelations } from "@/lib/db";

export type IssueEvent =
  | { type: "created"; issue: IssueWithRelations }
  | { type: "updated"; issue: IssueWithRelations }
  | { type: "deleted"; id: string };

// ⚠️ SINGLE-INSTANCE ONLY. This bus lives in one Node process's memory, so an
// event emitted by one instance never reaches SSE clients connected to another.
// The app MUST run as a single process (no PM2 cluster, no multi-replica, no
// serverless/Vercel) until this is replaced with a shared pub/sub (e.g. Redis).
// This file is the abstraction seam for that swap — see implementation_plan.md 7.3.
const globalWithBus = globalThis as typeof globalThis & {
  __bugboardBus?: EventEmitter;
};

const bus = (globalWithBus.__bugboardBus ??= new EventEmitter());
bus.setMaxListeners(200);

export const emitIssueEvent = (e: IssueEvent) => bus.emit("issue", e);
export const onIssueEvent = (fn: (e: IssueEvent) => void) => {
  bus.on("issue", fn);
  return () => bus.off("issue", fn);
};
