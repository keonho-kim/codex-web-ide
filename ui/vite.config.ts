import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@backend": fileURLToPath(new URL("../backend/src", import.meta.url)),
      "@bin": fileURLToPath(new URL("../bin", import.meta.url)),
      "@scripts": fileURLToPath(new URL("../scripts", import.meta.url)),
    },
  },
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("vite/preload-helper")) return "preload";
          if (!id.includes("/node_modules/")) return;
          if (id.includes("/node_modules/monaco-editor/") || id.includes("/node_modules/@monaco-editor/")) return "monaco";
          if (id.includes("/node_modules/@xterm/")) return "terminal";
          if (id.includes("/node_modules/diff2html/")) return "diff";
          if (["react-markdown", "remark-gfm", "remark-math", "rehype-raw", "rehype-sanitize", "rehype-katex", "katex"].some((pkg) => id.includes(`/node_modules/${pkg}/`))) return "markdown";
          if (["react-arborist", "react-resizable-panels", "lucide-react"].some((pkg) => id.includes(`/node_modules/${pkg}/`))) return "interaction";
          if (["radix-ui", "class-variance-authority", "clsx", "tailwind-merge"].some((pkg) => id.includes(`/node_modules/${pkg}/`))) return "primitives";
          if (["react", "react-dom", "react-router-dom", "@tanstack/react-query", "zustand"].some((pkg) => id.includes(`/node_modules/${pkg}/`))) return "vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:17321",
      "/preview": "http://127.0.0.1:17321",
    },
  },
});
