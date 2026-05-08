import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BottomPanel } from "./features/BottomPanel";
import { ProjectCreator, SessionCreator, Sidebar } from "./features/projects/ProjectControls";
import { Workbench } from "./features/Workbench";
import { api } from "./lib/api";
import type { Project, Session, WorkspaceSettings } from "./lib/types";
import { useUiStore } from "./store/uiStore";

export function App() {
  const queryClient = useQueryClient();
  const activeProjectId = useUiStore((state) => state.activeProjectId);
  const activeSessionId = useUiStore((state) => state.activeSessionId);
  const setActiveProjectId = useUiStore((state) => state.setActiveProjectId);
  const setActiveSessionId = useUiStore((state) => state.setActiveSessionId);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/api/projects") });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<Session[]>("/api/sessions") });
  const settings = useQuery({ queryKey: ["workspace-settings"], queryFn: () => api<WorkspaceSettings>("/api/workspace/settings") });
  const activeSession = sessions.data?.find((session) => session.id === activeSessionId);
  const orderedProjects = orderProjects(projects.data ?? [], settings.data);
  const openProject = useMutation({
    mutationFn: (id: string) => api<Project>(`/api/projects/${id}/open`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-settings"] }),
      ]);
    },
  });
  const deleteSession = useMutation({
    mutationFn: (id: string) => api(`/api/sessions/${id}`, { method: "DELETE" }),
    onSuccess: async (_result, id) => {
      if (activeSessionId === id) setActiveSessionId((sessions.data ?? []).find((session) => session.id !== id)?.id);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
  const updateSettings = useMutation({
    mutationFn: (next: WorkspaceSettings) => api<WorkspaceSettings>("/api/workspace/settings", { method: "PUT", body: next }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
  });

  useEffect(() => {
    if (activeProjectId || !projects.data?.length) return;
    const storedProjectId = settings.data?.activeProjectId;
    const storedProject = storedProjectId ? projects.data.find((project) => project.id === storedProjectId) : undefined;
    setActiveProjectId(storedProject?.id ?? projects.data[0].id);
  }, [activeProjectId, projects.data, setActiveProjectId, settings.data?.activeProjectId]);

  useEffect(() => {
    if (!activeSessionId && sessions.data?.[0]) setActiveSessionId(sessions.data[0].id);
  }, [activeSessionId, sessions.data, setActiveSessionId]);

  useSessionEvents(activeSessionId, queryClient);

  return (
    <main className="grid h-screen grid-cols-[230px_minmax(0,1fr)] grid-rows-[48px_minmax(0,1fr)_230px] bg-page text-ink max-[900px]:grid-cols-1 max-[900px]:grid-rows-[auto_150px_minmax(0,1fr)_220px]">
      <header className="col-span-full flex items-center justify-between gap-4 border-b border-hairline bg-canvas px-3 max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-2 max-[900px]:p-2">
        <div className="min-w-0">
          <strong className="block text-sm">Codex Web IDE</strong>
          <span className="block overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">{activeSession?.cwd || "No session selected"}</span>
        </div>
        <div className="flex items-center gap-2 max-[900px]:flex-wrap max-[900px]:items-stretch">
          <ProjectCreator onCreated={(project) => selectProject(project.id, setActiveProjectId, openProject.mutate)} />
          <SessionCreator projectId={activeProjectId} onCreated={(session) => setActiveSessionId(session.id)} />
        </div>
      </header>

      <Sidebar
        projects={orderedProjects}
        sessions={sessions.data ?? []}
        activeProjectId={activeProjectId}
        activeSessionId={activeSessionId}
        onProjectSelect={(id) => selectProject(id, setActiveProjectId, openProject.mutate)}
        onSessionSelect={setActiveSessionId}
        onSessionDelete={(id) => {
          if (confirm("Delete this session?")) deleteSession.mutate(id);
        }}
        settings={settings.data}
        onSettingsSave={(next) => updateSettings.mutate(next)}
        settingsPending={updateSettings.isPending}
      />

      <Workbench sessionId={activeSessionId} />

      <BottomPanel sessionId={activeSessionId} />
    </main>
  );
}

function selectProject(id: string, setActiveProjectId: (id: string) => void, openProject: (id: string) => void) {
  setActiveProjectId(id);
  openProject(id);
}

function orderProjects(projects: Project[], settings?: WorkspaceSettings) {
  const recentIds = settings?.recentProjectIds ?? [];
  return [...projects].sort((a, b) => {
    const recentA = recentIds.indexOf(a.id);
    const recentB = recentIds.indexOf(b.id);
    if (recentA !== -1 || recentB !== -1) return (recentA === -1 ? Number.MAX_SAFE_INTEGER : recentA) - (recentB === -1 ? Number.MAX_SAFE_INTEGER : recentB);
    return b.lastOpenedAt - a.lastOpenedAt;
  });
}

function useSessionEvents(activeSessionId: string | undefined, queryClient: ReturnType<typeof useQueryClient>) {
  useEffect(() => {
    if (!activeSessionId) return;
    const source = new EventSource(`/api/sessions/${activeSessionId}/events`);
    source.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ["git", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["jobs", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["previews", activeSessionId] });
    };
    source.addEventListener("codex.event", () => {
      void queryClient.invalidateQueries({ queryKey: ["codex", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["git", activeSessionId] });
    });
    source.addEventListener("job.finished", () => {
      void queryClient.invalidateQueries({ queryKey: ["jobs", activeSessionId] });
      void queryClient.invalidateQueries({ queryKey: ["git", activeSessionId] });
    });
    for (const eventName of ["job.started", "job.stdout", "job.stderr"]) {
      source.addEventListener(eventName, () => {
        void queryClient.invalidateQueries({ queryKey: ["jobs", activeSessionId] });
      });
    }
    for (const eventName of ["preview.started", "preview.stdout", "preview.stderr", "preview.health.updated", "preview.stopped"]) {
      source.addEventListener(eventName, () => {
        void queryClient.invalidateQueries({ queryKey: ["previews", activeSessionId] });
      });
    }
    for (const eventName of ["service.started", "service.stdout", "service.stderr", "service.stopped"]) {
      source.addEventListener(eventName, () => {
        void queryClient.invalidateQueries({ queryKey: ["services", activeSessionId] });
      });
    }
    source.addEventListener("file.changed", () => {
      void queryClient.invalidateQueries({ queryKey: ["tree", activeSessionId] });
    });
    return () => source.close();
  }, [activeSessionId, queryClient]);
}
