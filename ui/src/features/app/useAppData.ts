import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Project, Session, WorkspaceSettings } from "../../lib/types";
import { useUiStore } from "../../store/uiStore";

export function useAppData() {
  const queryClient = useQueryClient();
  const activeProjectId = useUiStore((state) => state.activeProjectId);
  const activeSessionId = useUiStore((state) => state.activeSessionId);
  const setActiveProjectId = useUiStore((state) => state.setActiveProjectId);
  const setActiveSessionId = useUiStore((state) => state.setActiveSessionId);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/api/projects") });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<Session[]>("/api/sessions") });
  const settings = useQuery({ queryKey: ["workspace-settings"], queryFn: () => api<WorkspaceSettings>("/api/workspace/settings") });
  const orderedProjects = orderProjects(projects.data ?? [], settings.data);
  const activeProject = orderedProjects.find((project) => project.id === activeProjectId);
  const projectSessions = filterSessionsForProject(sessions.data ?? [], activeProject);
  const activeSession = projectSessions.find((session) => session.id === activeSessionId);

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
      if (activeSessionId === id) setActiveSessionId(undefined);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
  const deleteProject = useMutation({
    mutationFn: (id: string) => api<Project>(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: async (_project, id) => {
      if (activeProjectId === id) {
        setActiveProjectId(undefined);
        setActiveSessionId(undefined);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-settings"] }),
      ]);
    },
  });

  const updateSettings = useMutation({
    mutationFn: (next: WorkspaceSettings) => api<WorkspaceSettings>("/api/workspace/settings", { method: "PUT", body: next }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspace-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["auth-status"] }),
      ]);
    },
  });

  useEffect(() => {
    if (!projects.data?.length) {
      if (activeProjectId) setActiveProjectId(undefined);
      return;
    }
    if (activeProjectId && projects.data.some((project) => project.id === activeProjectId)) return;
    const storedProjectId = settings.data?.activeProjectId;
    const storedProject = storedProjectId ? projects.data.find((project) => project.id === storedProjectId) : undefined;
    setActiveProjectId(storedProject?.id ?? projects.data[0].id);
  }, [activeProjectId, projects.data, setActiveProjectId, settings.data?.activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    if (activeSessionId && projectSessions.some((session) => session.id === activeSessionId)) return;
    const nextSessionId = projectSessions[0]?.id;
    if (activeSessionId === nextSessionId) return;
    setActiveSessionId(nextSessionId);
  }, [activeProjectId, activeSessionId, projectSessions, setActiveSessionId]);

  return {
    activeProjectId,
    activeSessionId,
    activeSession,
    orderedProjects,
    sessions: projectSessions,
    settings: settings.data,
    settingsPending: updateSettings.isPending,
    setActiveSessionId,
    selectProject: (id: string) => {
      setActiveProjectId(id);
      openProject.mutate(id);
    },
    deleteProject: (id: string) => deleteProject.mutate(id),
    deleteSession: (id: string) => deleteSession.mutate(id),
    updateSettings: (next: WorkspaceSettings) => updateSettings.mutate(next),
  };
}

function filterSessionsForProject(sessions: Session[], project?: Project) {
  if (!project) return sessions;
  return sessions.filter((session) => session.projectId === project.id || (!session.projectId && isInsideProject(session.cwd, project.cwd)));
}

function isInsideProject(cwd: string, projectCwd: string) {
  return cwd === projectCwd || cwd.startsWith(`${projectCwd.replace(/\/+$/, "")}/`);
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
