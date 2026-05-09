export type {
  CodexMessage,
  CodexSlashCommandDefinition,
  CodexSlashCommandResult,
  CodexStatusSnapshot,
  CodexThreadRecord,
  ComposerMention,
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
} from "../../../backend/src/shared/types";

export type MentionPopupState = {
  trigger: "@" | "$";
  query: string;
  selectedIndex: number;
};
