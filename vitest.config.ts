import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    coverage: {
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"]
    }
  }
});
