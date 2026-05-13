import { expect, test } from "bun:test";
import path from "node:path";
import { buildUpgradePlan } from "@backend/cli/upgrade";

test("builds an upgrade plan for a release installation", () => {
  const currentModulePath = path.join("/tmp", "cw", "v1.2.3-linux-arm64", "backend", "src", "cli", "upgrade.ts");
  const plan = buildUpgradePlan({
    currentModulePath,
    env: {
      CW_INSTALL_REPO: "owner/repo",
      CW_VERSION: "v1.2.4",
    },
  });

  expect(plan.installDir).toBe(path.join("/tmp", "cw", "v1.2.3-linux-arm64"));
  expect(plan.installRoot).toBe(path.join("/tmp", "cw"));
  expect(plan.scriptUrl).toBe("https://github.com/owner/repo/releases/latest/download/install.sh");
  expect(plan.env).toEqual({
    CW_INSTALL_REPO: "owner/repo",
    CW_INSTALL_ROOT: path.join("/tmp", "cw"),
    CW_PRUNE_OLD_INSTALLS: "1",
    CW_VERSION: "v1.2.4",
  });
});

test("refuses to upgrade from a development checkout", () => {
  const currentModulePath = path.join("/tmp", "codex-web-ide", "backend", "src", "cli", "upgrade.ts");

  expect(() => buildUpgradePlan({ currentModulePath, env: {} })).toThrow("Refusing to upgrade");
});
