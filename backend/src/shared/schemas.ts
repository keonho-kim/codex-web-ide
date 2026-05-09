import { z } from "zod";

export const relativePathSchema = z.string().default(".");
export const commandSchema = z.array(z.string().min(1)).min(1);

export const createProjectSchema = z.object({
  cwd: z.string().min(1),
  name: z.string().min(1).optional(),
});

export const browsePathSchema = z.string().min(1).optional();

export const createBrowseFolderSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(120).refine((name) => !name.includes("/") && !name.includes("\\") && name !== "." && name !== "..", {
    message: "Folder name must not contain path separators",
  }),
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

export const createTerminalSchema = z.object({
  cols: z.number().int().min(20).max(240).optional(),
  rows: z.number().int().min(6).max(80).optional(),
  shell: z.string().min(1).optional(),
});

export const resizeTerminalSchema = z.object({
  cols: z.number().int().min(20).max(240),
  rows: z.number().int().min(6).max(80),
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

export const codexSlashCommandSchema = z.object({
  command: z.string().min(1),
  args: z.string().default(""),
  options: z.record(z.unknown()).default({}),
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

const portSchema = z.number().int().min(1).max(65535);

export const workspaceSettingsSchema = z.object({
  host: z.string().min(1).default("127.0.0.1"),
  port: portSchema.default(17321),
  previewPortStart: portSchema.default(17330),
  previewPortEnd: portSchema.default(17399),
  defaultProjectsDir: z.string().min(1),
  activeProjectId: z.string().optional(),
  recentProjectIds: z.array(z.string()).default([]),
  auth: z
    .object({
      enabled: z.boolean().default(false),
      provider: z.literal("telegram").default("telegram"),
      singleSession: z.boolean().default(true),
      loginRequestTtlMs: z.number().int().positive().default(120000),
      heartbeatIntervalMs: z.number().int().positive().default(15000),
      sessionStaleMs: z.number().int().positive().default(90000),
      sessionIdleTimeoutMs: z.number().int().positive().default(1800000),
      sessionAbsoluteTtlMs: z.number().int().positive().default(43200000),
    })
    .default({ enabled: false, provider: "telegram", singleSession: true, loginRequestTtlMs: 120000, heartbeatIntervalMs: 15000, sessionStaleMs: 90000, sessionIdleTimeoutMs: 1800000, sessionAbsoluteTtlMs: 43200000 }),
  telegram: z
    .object({
      allowedTelegramUserId: z.number().int().optional(),
      allowedChatId: z.number().int().optional(),
      ownerDisplayName: z.string().optional(),
      botUsername: z.string().optional(),
      remoteControlEnabled: z.boolean().default(false),
    })
    .optional(),
}).refine((settings) => settings.previewPortStart <= settings.previewPortEnd, {
  message: "Preview port start must be less than or equal to preview port end",
  path: ["previewPortEnd"],
});

export const telegramPairingSchema = z.object({
  allowedTelegramUserId: z.number().int(),
  allowedChatId: z.number().int(),
  ownerDisplayName: z.string().optional(),
  botUsername: z.string().optional(),
});
