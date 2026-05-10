import { expect, test } from "bun:test";
import type { Session } from "../../lib/types";
import { codexSessionSignal } from "./sessionSignal";

const session: Session = {
  id: "session",
  name: "Project",
  cwd: "/tmp/project",
  createdAt: 1,
  lastActiveAt: 1,
  status: "idle",
};

test("marks running Codex sessions as in progress", () => {
  expect(codexSessionSignal({ ...session, status: "running" }).kind).toBe("running");
});

test("does not mark a never-used idle Codex session as completed", () => {
  expect(codexSessionSignal(session)).toEqual({ kind: "idle", label: "" });
});

test("marks a latest user event as a Codex response request", () => {
  expect(codexSessionSignal(session, [{ id: "event", label: "codex.user", role: "user", timestamp: 1 }])).toEqual({
    kind: "requested",
    label: "codex가 응답을 요청함",
  });
});

test("marks completed idle Codex sessions after an assistant event", () => {
  expect(codexSessionSignal(session, [{ id: "event", label: "agent_message", role: "assistant", timestamp: 1 }])).toEqual({
    kind: "completed",
    label: "응답 완료",
  });
});
