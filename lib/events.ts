import EventEmitter from "events";
import type { IssueWithRelations } from "@/lib/db";

export type IssueEvent =
  | { type: "created"; issue: IssueWithRelations }
  | { type: "updated"; issue: IssueWithRelations }
  | { type: "deleted"; id: string };

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
