import { Code2, MessageSquare, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { WorkbenchTab } from "@/store/uiStore";

export const workbenchTabs: Array<{ id: WorkbenchTab; label: string; icon: LucideIcon }> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "editor", label: "Editor", icon: Code2 },
  { id: "system", label: "System", icon: SlidersHorizontal },
];
