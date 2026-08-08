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

export const listQuerySchema = z.object({
  status: z.nativeEnum(Status).optional(),
  priority: z.nativeEnum(Priority).optional(),
  search: z.string().max(200).optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
