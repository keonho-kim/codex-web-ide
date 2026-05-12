import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { JsonStore } from "@backend/managers/storage";

export type AuthSecrets = {
  telegram?: {
    botToken?: string;
  };
  auth: {
    sessionSecret: string;
    csrfSecret: string;
  };
};

export class SecretsStore {
  constructor(private store: JsonStore) {}

  async read(): Promise<AuthSecrets> {
    const fallback = {
      auth: {
        sessionSecret: randomSecret(),
        csrfSecret: randomSecret(),
      },
    } satisfies AuthSecrets;
    const current = await this.store.read<Partial<AuthSecrets>>("secrets.json", fallback);
    const next = {
      telegram: current.telegram,
      auth: {
        sessionSecret: process.env.CW_SESSION_SECRET || current.auth?.sessionSecret || fallback.auth.sessionSecret,
        csrfSecret: process.env.CW_CSRF_SECRET || current.auth?.csrfSecret || fallback.auth.csrfSecret,
      },
    } satisfies AuthSecrets;
    if (!current.auth?.sessionSecret || !current.auth?.csrfSecret) await this.write(next);
    return next;
  }

  async write(secrets: AuthSecrets) {
    await this.store.ensure();
    const file = path.join(this.store.root, "secrets.json");
    const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(temp, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    await fs.chmod(temp, 0o600);
    await fs.rename(temp, file);
    await fs.chmod(file, 0o600);
  }

  async update(updater: (current: AuthSecrets) => AuthSecrets | Promise<AuthSecrets>) {
    const next = await updater(await this.read());
    await this.write(next);
    return next;
  }
}

function randomSecret() {
  return randomBytes(32).toString("base64url");
}
