export type {
  CodexMessage,
  CodexRuntimeDefaults,
  CodexSlashCommandDefinition,
  CodexSlashCommandResult,
  CodexStatusSnapshot,
  CodexThreadRecord,
  ComposerMention,
  Envelope,
  FileTreeNode,
  GitFileStatus,
  GitState,
  Job,
  LocalPathListing,
  PreviewInstance,
  Project,
  ServiceInstance,
  Session,
  TerminalSession,
  WorkspaceSettings,
} from "@backend/shared/types";

export type MentionPopupState = {
  trigger: "@" | "$";
  query: string;
  selectedIndex: number;
  start: number;
  end: number;
};
