import { z } from "zod";

export const relativePathSchema = z.string().default(".");
export const commandSchema = z.array(z.string().min(1)).min(1);

export const createProjectSchema = z.object({
  cwd: z.string().min(1),
  name: z.string().min(1).optional(),
});

export const createSessionSchema = z.object({
  projectId: z.string().optional(),
  cwd: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
});

export const writeFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const createFileSchema = z.object({
  path: z.string(),
  isDirectory: z.boolean().default(false),
  content: z.string().default(""),
});

export const renameFileSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const deleteFileSchema = z.object({
  path: z.string(),
});

export const commandRequestSchema = z.object({
  command: commandSchema,
  cwd: z.string().optional(),
  timeoutMs: z.number().positive().optional(),
  approvedDangerous: z.boolean().default(false),
});

export const codexRunSchema = z.object({
  prompt: z.string().min(1),
  mentions: z
    .array(
      z.union([
        z.object({ type: z.literal("file"), path: z.string(), isDirectory: z.boolean() }),
        z.object({ type: z.literal("skill"), id: z.string(), name: z.string() }),
      ]),
    )
    .default([]),
});

export const createCodexThreadSchema = z.object({
  title: z.string().min(1).optional(),
});

export const gitPathSchema = z.object({
  path: z.string().optional(),
});

export const gitCommitSchema = z.object({
  message: z.string().min(1),
});

export const gitBranchSchema = z.object({
  branch: z.string().min(1),
});

export const workspaceSettingsSchema = z.object({
  defaultProjectsDir: z.string().min(1),
  activeProjectId: z.string().optional(),
  recentProjectIds: z.array(z.string()).default([]),
  auth: z
    .object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
    })
    .default({ enabled: false }),
});
