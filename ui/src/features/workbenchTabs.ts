import { BarChart3, Code2, GitBranch, MessageSquare, type LucideIcon } from "lucide-react";
import type { WorkbenchTab } from "../store/uiStore";

export const workbenchTabs: Array<{ id: WorkbenchTab; label: string; icon: LucideIcon }> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "editor", label: "Editor", icon: Code2 },
  { id: "control", label: "Control", icon: GitBranch },
  { id: "usage", label: "Codex Usage", icon: BarChart3 },
];
