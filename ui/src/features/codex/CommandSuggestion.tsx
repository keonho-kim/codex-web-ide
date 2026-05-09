import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, splitCommand } from "../../lib/api";
import { confirmDangerousCommand, requiresDangerousApproval } from "../../lib/commandSafety";
import { getErrorMessage } from "../../lib/errors";
import { useUiStore, type ControlTab } from "../../store/uiStore";

type ManagedKind = "job" | "preview" | "service";

type ManagedSuggestion = {
  kind: ManagedKind;
  command: string[];
  source: string;
};

const controlTabByKind: Partial<Record<ManagedKind, ControlTab>> = {
  job: "jobs",
  service: "services",
};

export function CommandSuggestion({ sessionId, text }: { sessionId?: string; text: string }) {
  const suggestion = parseManagedSuggestion(text);
  const [dismissed, setDismissed] = useState(false);
  const queryClient = useQueryClient();
  const setWorkbenchTab = useUiStore((state) => state.setWorkbenchTab);
  const setControlTab = useUiStore((state) => state.setControlTab);
  const setPreviewOpen = useUiStore((state) => state.setPreviewOpen);
  const run = useMutation({
    mutationFn: async () => {
      if (!sessionId || !suggestion) throw new Error("No active session.");
      return api(`/api/sessions/${sessionId}/commands/${suggestion.kind}`, {
        method: "POST",
        body: {
          command: suggestion.command,
          approvedDangerous: requiresDangerousApproval(suggestion.command),
        },
      });
    },
    onSuccess: async () => {
      if (!sessionId || !suggestion) return;
      if (suggestion.kind === "preview") {
        setPreviewOpen(true);
      } else {
        setWorkbenchTab("control");
        setControlTab(controlTabByKind[suggestion.kind] ?? "jobs");
      }
      await queryClient.invalidateQueries({ queryKey: [`${suggestion.kind}s`, sessionId] });
    },
  });

  if (!sessionId || !suggestion || dismissed) return null;

  return (
    <div className="mt-2 grid gap-2 rounded-md border border-subtle bg-panel p-2 text-xs">
      <div className="min-w-0">
        <strong className="block text-xs text-primary">Suggested command</strong>
        <code className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-ink">{suggestion.source}</code>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={run.isPending}
          onClick={() => {
            if (confirmDangerousCommand(suggestion.command)) run.mutate();
          }}
        >
          <Play data-icon="inline-start" />
          Run
        </Button>
        <Button type="button" variant="outline" size="icon-sm" title="Ignore suggested command" onClick={() => setDismissed(true)}>
          <X data-icon="inline-start" />
        </Button>
      </div>
      {run.error ? <p className="m-0 text-xs text-destructive">{getErrorMessage(run.error)}</p> : null}
    </div>
  );
}

export function parseManagedSuggestion(text: string): ManagedSuggestion | null {
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim().replace(/^[$>]\s*/, "").replace(/^`|`$/g, "");
    const match = /^(?:cw|codex-web)\s+(job|preview|service)\s+(.+)$/.exec(line);
    if (!match) continue;
    const command = splitCommand(match[2]);
    if (command.length === 0) continue;
    return { kind: match[1] as ManagedKind, command, source: `cw ${match[1]} ${match[2]}` };
  }
  return null;
}
