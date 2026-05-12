import { defineConfig, devices } from "@playwright/test";

const tablet = (viewport: { width: number; height: number }) => ({
  ...devices["Desktop Chrome"],
  browserName: "chromium" as const,
  viewport,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const pixel7 = (viewport: { width: number; height: number }) => ({
  ...devices["Pixel 7"],
  browserName: "chromium" as const,
  viewport,
});

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
      name: "tablet-7-8-portrait",
      use: tablet({ width: 720, height: 960 }),
    },
    {
      name: "tablet-7-8-landscape",
      use: tablet({ width: 960, height: 720 }),
    },
    {
      name: "ipad-mini-portrait",
      use: tablet({ width: 768, height: 1024 }),
    },
    {
      name: "ipad-mini-landscape",
      use: tablet({ width: 1024, height: 768 }),
    },
    {
      name: "pixel-7-portrait",
      use: pixel7({ width: 412, height: 915 }),
    },
    {
      name: "pixel-7-landscape",
      use: pixel7({ width: 915, height: 412 }),
    },
  ],
});
