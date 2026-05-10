import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          diff: ["diff2html"],
          editor: ["@monaco-editor/react"],
          interaction: ["react-arborist", "react-resizable-panels", "lucide-react"],
          markdown: ["react-markdown", "remark-gfm", "remark-math", "rehype-raw", "rehype-sanitize", "rehype-katex", "katex"],
          tiptap: ["@tiptap/react", "@tiptap/starter-kit"],
          primitives: ["radix-ui", "class-variance-authority", "clsx", "tailwind-merge"],
          vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "zustand"],
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
