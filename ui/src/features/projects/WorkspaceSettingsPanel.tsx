import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspaceSettings } from "../../lib/types";

export function WorkspaceSettingsPanel({
  settings,
  onSave,
  pending = false,
}: {
  settings?: WorkspaceSettings;
  onSave(settings: WorkspaceSettings): void;
  pending?: boolean;
}) {
  const [defaultProjectsDir, setDefaultProjectsDir] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [previewPortStart, setPreviewPortStart] = useState("");
  const [previewPortEnd, setPreviewPortEnd] = useState("");

  useEffect(() => {
    setDefaultProjectsDir(settings?.defaultProjectsDir ?? "");
    setHost(settings?.host ?? "");
    setPort(settings ? String(settings.port) : "");
    setPreviewPortStart(settings ? String(settings.previewPortStart) : "");
    setPreviewPortEnd(settings ? String(settings.previewPortEnd) : "");
  }, [settings]);

  const parsedPort = parsePort(port);
  const parsedPreviewPortStart = parsePort(previewPortStart);
  const parsedPreviewPortEnd = parsePort(previewPortEnd);
  const canSave = Boolean(settings && defaultProjectsDir.trim() && host.trim() && parsedPort && parsedPreviewPortStart && parsedPreviewPortEnd && parsedPreviewPortStart <= parsedPreviewPortEnd && !pending);

  return (
    <form
      className="grid gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!settings || !canSave || !parsedPort || !parsedPreviewPortStart || !parsedPreviewPortEnd) return;
        onSave({
          ...settings,
          host: host.trim(),
          port: parsedPort,
          previewPortStart: parsedPreviewPortStart,
          previewPortEnd: parsedPreviewPortEnd,
          defaultProjectsDir: defaultProjectsDir.trim(),
        });
      }}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1">
        <input
          className="compact-input flex-1"
          value={defaultProjectsDir}
          onChange={(event) => setDefaultProjectsDir(event.target.value)}
          placeholder="Default project directory"
        />
        <Button className="row-span-3" title="Save workspace settings" type="submit" disabled={!canSave} variant="outline" size="icon-xs">
          <Save data-icon="inline-start" />
        </Button>
        <input
          className="compact-input"
          value={host}
          onChange={(event) => setHost(event.target.value)}
          placeholder="Host"
        />
        <div className="grid grid-cols-3 gap-1">
          <input
            className="compact-input"
            value={port}
            onChange={(event) => setPort(event.target.value)}
            inputMode="numeric"
            placeholder="App port"
          />
          <input
            className="compact-input"
            value={previewPortStart}
            onChange={(event) => setPreviewPortStart(event.target.value)}
            inputMode="numeric"
            placeholder="Preview from"
          />
          <input
            className="compact-input"
            value={previewPortEnd}
            onChange={(event) => setPreviewPortEnd(event.target.value)}
            inputMode="numeric"
            placeholder="Preview to"
          />
        </div>
      </div>
      <p className="empty-state">Recent projects: {settings?.recentProjectIds.length ?? 0}</p>
    </form>
  );
}

function parsePort(value: string) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}
