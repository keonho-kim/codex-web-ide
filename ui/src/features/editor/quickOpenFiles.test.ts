import { expect, test } from "bun:test";
import type { FileTreeNode } from "../../lib/types";
import { filterFiles, flattenFiles } from "./quickOpenFiles";

test("flattens file tree nodes into file paths", () => {
  const nodes: FileTreeNode[] = [
    {
      id: "src",
      name: "src",
      path: "src",
      isDirectory: true,
      children: [
        { id: "src/app.ts", name: "app.ts", path: "src/app.ts", isDirectory: false },
        {
          id: "src/components",
          name: "components",
          path: "src/components",
          isDirectory: true,
          children: [{ id: "src/components/Button.tsx", name: "Button.tsx", path: "src/components/Button.tsx", isDirectory: false }],
        },
      ],
    },
  ];

  expect(flattenFiles(nodes)).toEqual(["src/app.ts", "src/components/Button.tsx"]);
});

test("filters quick-open files case-insensitively", () => {
  expect(filterFiles(["src/App.tsx", "README.md", "backend/server.ts"], "app")).toEqual(["src/App.tsx"]);
  expect(filterFiles(["src/App.tsx"], "   ")).toEqual(["src/App.tsx"]);
});
