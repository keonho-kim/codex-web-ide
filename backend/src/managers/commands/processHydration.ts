type DetachedProcessRecord = {
  pid: number;
  status: "starting" | "running" | "failed" | "stopped";
};

export function restoreDetachedProcess<T extends DetachedProcessRecord>(record: T): T {
  if (record.status !== "running" && record.status !== "starting") return record;
  return { ...record, pid: 0, status: "stopped" };
}
