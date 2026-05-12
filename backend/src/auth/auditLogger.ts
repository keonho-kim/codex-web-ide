import fs from "node:fs/promises";
import path from "node:path";
import type { JsonStore } from "@backend/managers/storage";

export type AuditEvent = {
  type: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  detail?: Record<string, unknown>;
};

export class AuditLogger {
  constructor(private store: JsonStore) {}

  async write(event: AuditEvent) {
    await this.store.ensure();
    const file = path.join(this.store.root, "logs", "audit.log");
    const record = {
      timestamp: Date.now(),
      ...redact(event),
    };
    await fs.appendFile(file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  }
}

function redact(event: AuditEvent) {
  const detail = event.detail ? { ...event.detail } : undefined;
  for (const key of Object.keys(detail ?? {})) {
    if (/token|secret|cookie|csrf|password/i.test(key)) delete detail?.[key];
  }
  return { ...event, detail };
}
