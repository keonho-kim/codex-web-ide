import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export class JsonStore {
  readonly root: string;

  constructor(root = process.env.CODEX_WEB_HOME || path.join(os.homedir(), ".codex-web")) {
    this.root = root;
  }

  async ensure() {
    await fs.mkdir(this.root, { recursive: true });
    for (const dir of ["logs", "jobs", "previews", "services", "cache", "codex"]) {
      await fs.mkdir(path.join(this.root, dir), { recursive: true });
    }
  }

  async read<T>(name: string, fallback: T): Promise<T> {
    await this.ensure();
    try {
      return JSON.parse(await fs.readFile(path.join(this.root, name), "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw error;
    }
  }

  async write<T>(name: string, value: T): Promise<void> {
    await this.ensure();
    const file = path.join(this.root, name);
    const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(temp, JSON.stringify(value, null, 2));
    await fs.rename(temp, file);
  }

  async delete(name: string): Promise<void> {
    await fs.rm(path.join(this.root, name), { force: true });
  }
}
