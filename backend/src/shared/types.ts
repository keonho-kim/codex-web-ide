export type SessionStatus = "idle" | "running" | "error";
export type CommandKind = "job" | "preview" | "service";
export type Runtime = "bun" | "python" | "go" | "rust" | "shell";

export type Session = {
  id: string;
  projectId?: string;
  name: string;
  cwd: string;
  createdAt: number;
  lastActiveAt: number;
  activeCodexThreadId?: string;
  codexThreadId?: string;
  status: SessionStatus;
};

export type Project = {
  id: string;
  name: string;
  cwd: string;
  lastOpenedAt: number;
};

export type WorkspaceSettings = {
  host: string;
  port: number;
  previewPortStart: number;
  previewPortEnd: number;
  defaultProjectsDir: string;
  activeProjectId?: string;
  recentProjectIds: string[];
  auth: {
    enabled: boolean;
    token?: string;
  };
};

export type FileTreeNode = {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
};

export type LocalPathEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

export type LocalPathListing = {
  path: string;
  parentPath?: string;
  entries: LocalPathEntry[];
};

export type ComposerMention =
  | { type: "file"; path: string; isDirectory: boolean }
  | { type: "skill"; id: string; name: string };

export type CommandSpec = {
  id: string;
  sessionId: string;
  cwd: string;
  kind: CommandKind;
  runtime: Runtime;
  command: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
  port?: number;
};

export type Job = {
  id: string;
  sessionId: string;
  cwd: string;
  command: string[];
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number;
  stdout: string[];
  stderr: string[];
};

export type PreviewInstance = {
  id: string;
  sessionId: string;
  cwd: string;
  command: string[];
  port: number;
  pid: number;
  status: "starting" | "running" | "failed" | "stopped";
  localUrl: string;
  publicUrl: string;
  startedAt: number;
  lastHealthCheckAt?: number;
  stdout: string[];
  stderr: string[];
};

export type ServiceInstance = {
  id: string;
  sessionId: string;
  cwd: string;
  command: string[];
  pid: number;
  status: "starting" | "running" | "failed" | "stopped";
  startedAt: number;
  lastHealthCheckAt?: number;
  restartCount: number;
  stdout: string[];
  stderr: string[];
};

export type GitFileStatus = {
  path: string;
  index: string;
  worktree: string;
  untracked: boolean;
};

export type GitState = {
  branch: string | null;
  detached: boolean;
  commit: string | null;
  upstream?: string;
  ahead?: number;
  behind?: number;
  dirty: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
};

export type CodexMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: number;
};

export type CodexThreadRecord = {
  id: string;
  sessionId: string;
  title: string;
  codexThreadId?: string;
  createdAt: number;
  lastActiveAt: number;
};

export type SessionEvent =
  | { type: "codex.event"; payload: unknown }
  | { type: "job.started"; job: Job }
  | { type: "job.stdout"; jobId: string; text: string }
  | { type: "job.stderr"; jobId: string; text: string }
  | { type: "job.finished"; jobId: string; exitCode: number }
  | { type: "preview.started"; preview: PreviewInstance }
  | { type: "preview.stdout"; previewId: string; text: string }
  | { type: "preview.stderr"; previewId: string; text: string }
  | { type: "preview.health.updated"; preview: PreviewInstance }
  | { type: "preview.stopped"; previewId: string }
  | { type: "service.started"; service: ServiceInstance }
  | { type: "service.stdout"; serviceId: string; text: string }
  | { type: "service.stderr"; serviceId: string; text: string }
  | { type: "service.health.updated"; service: ServiceInstance }
  | { type: "service.stopped"; serviceId: string }
  | { type: "git.state.updated"; state: GitState }
  | { type: "file.changed"; path: string };

export type Envelope<T extends SessionEvent = SessionEvent> = T & {
  id: string;
  sessionId: string;
  timestamp: number;
};
