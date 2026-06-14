import { z } from "zod";
import { Priority, Status } from "@prisma/client";

export const createIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required"),
  priority: z.nativeEnum(Priority),
  assigneeId: z.string().cuid().optional(),
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(Status),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
