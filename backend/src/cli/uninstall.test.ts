import { afterEach, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { uninstallCurrentInstallation } from "@backend/cli/uninstall";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => fs.rm(root, { force: true, recursive: true })));
  tempRoots.length = 0;
});

test("uninstalls the current release directory and managed launchers", async () => {
  const root = await tempRoot();
  const installRoot = path.join(root, "share", "codex-web-ide");
  const installDir = path.join(installRoot, "v1.2.3-linux-arm64");
  const cliDir = path.join(installDir, "backend", "src", "cli");
  const binDir = path.join(root, "bin");
  await fs.mkdir(cliDir, { recursive: true });
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(path.join(cliDir, "uninstall.ts"), "");
  await fs.writeFile(path.join(binDir, "cw"), `#!/bin/sh\nexec bun '${path.join(installDir, "backend", "src", "cli", "cw.ts")}' "$@"\n`);
  await fs.writeFile(path.join(binDir, "codex-web"), "#!/bin/sh\nexec echo custom\n");

  const plan = await uninstallCurrentInstallation({
    currentModulePath: path.join(cliDir, "uninstall.ts"),
    globalBinDir: binDir,
    installRoot,
  });

  expect(plan.installDir).toBe(installDir);
  await expect(fs.stat(installDir)).rejects.toThrow();
  await expect(fs.stat(path.join(binDir, "cw"))).rejects.toThrow();
  expect(await fs.readFile(path.join(binDir, "codex-web"), "utf8")).toContain("custom");
  expect(plan.launchers).toEqual([
    { path: path.join(binDir, "cw"), removed: true },
    { path: path.join(binDir, "codex-web"), removed: false, reason: "not managed by this installation" },
  ]);
});

test("refuses to uninstall outside the release install root", async () => {
  const root = await tempRoot();
  const currentModulePath = path.join(root, "checkout", "backend", "src", "cli", "uninstall.ts");

  await expect(
    uninstallCurrentInstallation({
      currentModulePath,
      globalBinDir: path.join(root, "bin"),
      installRoot: path.join(root, "share", "codex-web-ide"),
    }),
  ).rejects.toThrow("Refusing to uninstall");
});

async function tempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-web-uninstall-"));
  tempRoots.push(root);
  return root;
}
