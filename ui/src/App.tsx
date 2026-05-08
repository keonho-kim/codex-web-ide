import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BottomPanel } from "./features/BottomPanel";
import { CodexPane } from "./features/codex/CodexPane";
import { EditorPane } from "./features/editor/EditorPane";
import { FilePane } from "./features/files/FilePane";
import { ProjectCreator, SessionCreator, Sidebar } from "./features/projects/ProjectControls";
import { api } from "./lib/api";
import type { Project, Session } from "./lib/types";
import { useUiStore } from "./store/uiStore";

export function App() {
  const queryClient = useQueryClient();
  const activeProjectId = useUiStore((state) => state.activeProjectId);
  const activeSessionId = useUiStore((state) => state.activeSessionId);
  const setActiveProjectId = useUiStore((state) => state.setActiveProjectId);
  const setActiveSessionId = useUiStore((state) => state.setActiveSessionId);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/api/projects") });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<Session[]>("/api/sessions") });
  const activeSession = sessions.data?.find((session) => session.id === activeSessionId);

  useEffect(() => {
    if (!activeProjectId && projects.data?.[0]) setActiveProjectId(projects.data[0].id);
  }, [activeProjectId, projects.data, setActiveProjectId]);

  useEffect(() => {
    if (!activeSessionId && sessions.data?.[0]) setActiveSessionId(sessions.data[0].id);
  }, [activeSessionId, sessions.data, setActiveSessionId]);

  useSessionEvents(activeSessionId, queryClient);

  return (
    <main className="grid h-screen grid-cols-[230px_minmax(0,1fr)] grid-rows-[48px_minmax(0,1fr)_230px] bg-[#f5f5f7] text-[#1d1d1f] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[auto_150px_minmax(0,1fr)_220px]">
      <header className="col-span-full flex items-center justify-between gap-4 border-b border-[#e0e0e0] bg-white px-3 max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-2 max-[900px]:p-2">
        <div className="min-w-0">
          <strong className="block text-sm">Codex Web IDE</strong>
          <span className="block overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[#7a7a7a]">{activeSession?.cwd || "No session selected"}</span>
        </div>
        <div className="flex items-center gap-2 max-[900px]:flex-wrap max-[900px]:items-stretch">
          <ProjectCreator onCreated={(project) => setActiveProjectId(project.id)} />
          <SessionCreator projectId={activeProjectId} onCreated={(session) => setActiveSessionId(session.id)} />
        </div>
      </header>

      <Sidebar
        projects={projects.data ?? []}
        sessions={sessions.data ?? []}
        activeProjectId={activeProjectId}
        activeSessionId={activeSessionId}
        onProjectSelect={setActiveProjectId}
        onSessionSelect={setActiveSessionId}
      />

      <section className="grid min-h-0 grid-cols-[240px_minmax(360px,1fr)_minmax(280px,34%)] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[160px_minmax(260px,1fr)_220px]">
        <FilePane sessionId={activeSessionId} />
        <EditorPane sessionId={activeSessionId} />
        <CodexPane sessionId={activeSessionId} />
      </section>

      <BottomPanel sessionId={activeSessionId} />
    </main>
  );
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
    for (const eventName of ["preview.started", "preview.stopped"]) {
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
