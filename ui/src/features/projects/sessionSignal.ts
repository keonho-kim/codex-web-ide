import type { CodexEventSummary } from "../../store/uiStore";
import type { Session } from "../../lib/types";

export type CodexSessionSignal =
  | { kind: "running"; label: "진행 중" }
  | { kind: "requested"; label: "codex가 응답을 요청함" }
  | { kind: "completed"; label: "응답 완료" }
  | { kind: "error"; label: "오류" };

export function codexSessionSignal(session: Session, events: CodexEventSummary[] = []): CodexSessionSignal {
  if (session.status === "running") return { kind: "running", label: "진행 중" };
  if (session.status === "error") return { kind: "error", label: "오류" };
  const latest = events.at(-1);
  if (latest?.role === "user") return { kind: "requested", label: "codex가 응답을 요청함" };
  return { kind: "completed", label: "응답 완료" };
}
