import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const binDir = path.join(root, "dist", "bin");
const launcherPath = path.join(binDir, "cw");

await mkdir(binDir, { recursive: true });
await writeFile(
  launcherPath,
  `#!/usr/bin/env bun
import "../../backend/src/cli/cw.ts";
`,
);
await chmod(launcherPath, 0o755);

console.log(`Prepared install launcher at ${path.relative(root, launcherPath)}`);
