import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  test: {
    // without this, files no test imports are left out of the report instead of showing 0%.
    coverage: { include: ["src/**/*.{ts,tsx}"] },
  },
});
