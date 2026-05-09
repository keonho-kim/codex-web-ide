import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Circle, Plus, Square, Terminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../lib/api";
import { cn } from "../../lib/classes";
import type { TerminalSession } from "../../lib/types";

export function EditorTerminalPanel({ onClose, sessionId }: { onClose(): void; sessionId?: string }) {
  const queryClient = useQueryClient();
  const [activeTerminalId, setActiveTerminalId] = useState<string>();
  const terminalHost = useRef<HTMLDivElement>(null);
  const terminals = useQuery({
    queryKey: ["terminals", sessionId],
    queryFn: () => api<TerminalSession[]>(`/api/sessions/${sessionId}/terminals`),
    enabled: Boolean(sessionId),
  });
  const createTerminal = useMutation({
    mutationFn: () => api<TerminalSession>(`/api/sessions/${sessionId}/terminals`, { method: "POST", body: { cols: 100, rows: 28 } }),
    onSuccess: async (terminal) => {
      setActiveTerminalId(terminal.id);
      await queryClient.invalidateQueries({ queryKey: ["terminals", sessionId] });
    },
  });
  const closeTerminal = useMutation({
    mutationFn: (terminalId: string) => api(`/api/sessions/${sessionId}/terminals/${terminalId}`, { method: "DELETE" }),
    onSuccess: async (_result, terminalId) => {
      if (activeTerminalId === terminalId) setActiveTerminalId(undefined);
      await queryClient.invalidateQueries({ queryKey: ["terminals", sessionId] });
    },
  });
  const orderedTerminals = useMemo(() => [...(terminals.data ?? [])].sort((left, right) => left.createdAt - right.createdAt), [terminals.data]);
  const activeTerminal = orderedTerminals.find((terminal) => terminal.id === activeTerminalId) ?? orderedTerminals[0];

  useEffect(() => {
    if (!sessionId || terminals.isLoading || createTerminal.isPending) return;
    if ((terminals.data ?? []).length === 0) createTerminal.mutate();
  }, [createTerminal, sessionId, terminals.data, terminals.isLoading]);

  useEffect(() => {
    if (!activeTerminal) return;
    if (activeTerminalId !== activeTerminal.id) setActiveTerminalId(activeTerminal.id);
  }, [activeTerminal, activeTerminalId]);

  usePtySocket({ sessionId, terminal: activeTerminal, host: terminalHost });

  return (
    <aside className="grid h-64 min-h-0 grid-rows-[40px_minmax(0,1fr)] border-t border-hairline bg-panel" data-testid="editor-terminal-panel">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-hairline px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal size={15} className="text-muted" />
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {orderedTerminals.map((terminal, index) => (
              <button
                className={cn(
                  "inline-flex h-7 max-w-48 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs",
                  terminal.id === activeTerminal?.id ? "border-selected-border bg-selected text-primary" : "border-transparent text-muted hover:bg-page",
                )}
                key={terminal.id}
                type="button"
                onClick={() => setActiveTerminalId(terminal.id)}
              >
                <Circle className={terminal.status === "running" ? "fill-success text-success" : "text-muted"} size={8} />
                <span className="truncate">shell {index + 1}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button title="New terminal" type="button" variant="ghost" size="icon-xs" disabled={!sessionId || createTerminal.isPending} onClick={() => createTerminal.mutate()}>
            <Plus data-icon="inline-start" />
          </Button>
          {activeTerminal ? (
            <Button title="Kill terminal" type="button" variant="ghost" size="icon-xs" disabled={closeTerminal.isPending} onClick={() => closeTerminal.mutate(activeTerminal.id)}>
              <Square data-icon="inline-start" />
            </Button>
          ) : null}
          <Button title="Close terminal panel" type="button" variant="ghost" size="icon-xs" onClick={onClose}>
            <X data-icon="inline-start" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 bg-ink p-2">
        <div ref={terminalHost} className="h-full min-h-0 overflow-hidden rounded-md" />
      </div>
    </aside>
  );
}

function usePtySocket({
  host,
  sessionId,
  terminal,
}: {
  host: RefObject<HTMLDivElement | null>;
  sessionId?: string;
  terminal?: TerminalSession;
}) {
  useEffect(() => {
    const element = host.current;
    if (!sessionId || !terminal || !element) return;
    element.replaceChildren();
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      lineHeight: 1.25,
      theme: {
        background: "#24231f",
        foreground: "#f4f1ea",
        cursor: "#f4f1ea",
        selectionBackground: "#5b6f8655",
      },
    });
    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.open(element);
    fit.fit();
    const socket = new WebSocket(terminalSocketUrl(sessionId, terminal.id));
    const sendResize = () => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: "resize", cols: xterm.cols, rows: xterm.rows }));
    };
    const input = xterm.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "input", data }));
    });
    socket.addEventListener("open", sendResize);
    socket.addEventListener("message", (event) => {
      const payload = parseTerminalMessage(String(event.data));
      if (payload?.type === "output" && typeof payload.data === "string") xterm.write(payload.data);
      if (payload?.type === "exit") xterm.writeln(`\r\n[process exited]`);
    });
    socket.addEventListener("close", () => {
      xterm.writeln("\r\n[terminal disconnected]");
    });
    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      sendResize();
    });
    resizeObserver.observe(element);
    xterm.focus();
    return () => {
      resizeObserver.disconnect();
      input.dispose();
      socket.close();
      xterm.dispose();
    };
  }, [host, sessionId, terminal]);
}

function terminalSocketUrl(sessionId: string, terminalId: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/sessions/${encodeURIComponent(sessionId)}/terminals/${encodeURIComponent(terminalId)}/ws`;
}

function parseTerminalMessage(message: string) {
  try {
    return JSON.parse(message) as { type?: string; data?: unknown };
  } catch {
    return undefined;
  }
}
