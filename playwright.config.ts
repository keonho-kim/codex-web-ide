import { defineConfig, devices } from "@playwright/test";

const ipadMini = {
  ...devices["Desktop Chrome"],
  browserName: "chromium" as const,
  viewport: { width: 768, height: 1024 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: "./ui/e2e",
  testMatch: "**/*.pw.ts",
  reporter: "line",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:17325",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run cw start --host 127.0.0.1 --port 17325 --auth disable",
    url: "http://127.0.0.1:17325/api/health",
    reuseExistingServer: false,
    timeout: 15000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "ipad-mini",
      use: ipadMini,
    },
    {
      name: "pixel-7",
      use: { ...devices["Pixel 7"], browserName: "chromium", viewport: { width: 412, height: 915 } },
    },
  ],
});
