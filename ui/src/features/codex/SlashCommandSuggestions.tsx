import { Settings2, TerminalSquare } from "lucide-react";
import { cn } from "../../lib/classes";
import type { CodexSlashCommandDefinition } from "../../lib/types";

export function SlashCommandSuggestions({
  commands,
  selectedIndex,
  onSelect,
}: {
  commands: CodexSlashCommandDefinition[];
  selectedIndex: number;
  onSelect(command: CodexSlashCommandDefinition): void;
}) {
  if (commands.length === 0) return null;
  return (
    <div className="absolute right-0 bottom-full left-0 z-20 mb-2 max-h-72 overflow-auto rounded-md border border-control bg-panel p-1 shadow-lg">
      {commands.map((command, index) => {
        const Icon = command.nativeSurface === "modal" ? Settings2 : TerminalSquare;
        return (
          <button
            className={cn(
              "grid w-full grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left",
              index === selectedIndex && "border-selected-border bg-selected text-primary",
            )}
            key={command.command}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(command);
            }}
          >
            <Icon size={15} />
            <span className="min-w-0">
              <strong className="block text-xs">/{command.command}</strong>
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted">{command.description}</span>
            </span>
            <span className="rounded border border-subtle px-1.5 py-0.5 text-[10px] text-muted">{surfaceLabel(command.nativeSurface)}</span>
          </button>
        );
      })}
    </div>
  );
}

function surfaceLabel(surface: CodexSlashCommandDefinition["nativeSurface"]) {
  if (surface === "modal") return "modal";
  if (surface === "tab") return "tab";
  if (surface === "composer") return "run";
  return "native";
}
