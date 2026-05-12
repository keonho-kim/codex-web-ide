export type {
  CodexMessage,
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
};
