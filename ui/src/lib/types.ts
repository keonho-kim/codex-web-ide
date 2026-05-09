export type {
  CodexMessage,
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
  WorkspaceSettings,
} from "../../../backend/src/shared/types";

export type MentionPopupState = {
  trigger: "@" | "$";
  query: string;
  selectedIndex: number;
};
