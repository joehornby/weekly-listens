import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  minify: false,
  bundle: true,
  entry: ["index.ts"],
  format: ["esm"],
  sourcemap: true,
  target: "esnext",
  outDir: "dist",
});
