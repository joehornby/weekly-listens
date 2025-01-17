import { defineConfig } from "tsup";

const isDev = process.env.npm_lifecycle_event === "dev";

export default defineConfig({
  clean: true,
  minify: !isDev,
  bundle: true,
  entry: ["index.ts"],
  format: ["esm"],
  sourcemap: true,
  target: "esnext",
  outDir: "dist",
});
