import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: { enabled: true },
  },
  vite: {
    // GitHub Pages serves this project site from /autoscope/.
    base: "/autoscope/",
  },
});
