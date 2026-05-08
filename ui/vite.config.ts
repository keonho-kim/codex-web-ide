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
          editor: ["@monaco-editor/react"],
          tiptap: ["@tiptap/react", "@tiptap/starter-kit"],
          vendor: ["react", "react-dom", "@tanstack/react-query", "zustand"],
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
