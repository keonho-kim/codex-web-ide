import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const binDir = path.join(root, "dist", "bin");
const launcherPath = path.join(binDir, "cw");

await mkdir(binDir, { recursive: true });
await writeFile(
  launcherPath,
  `#!/bin/sh
set -eu

script="$0"
while [ -L "$script" ]; do
  script_dir="$(CDPATH= cd -- "$(dirname -- "$script")" && pwd -P)"
  link_target="$(readlink "$script")"
  case "$link_target" in
    /*) script="$link_target" ;;
    *) script="$script_dir/$link_target" ;;
  esac
done

script_dir="$(CDPATH= cd -- "$(dirname -- "$script")" && pwd -P)"
exec bun "$script_dir/../../backend/src/cli/cw.ts" "$@"
`,
);
await chmod(launcherPath, 0o755);

console.log(`Prepared install launcher at ${path.relative(root, launcherPath)}`);
