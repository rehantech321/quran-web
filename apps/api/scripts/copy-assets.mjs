import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// tsc only compiles .ts -> .js; it never copies non-TS files (the embedded
// Arabic-capable fonts PDF export needs — see src/utils/pdf.ts) into dist/.
// Runs after `tsc` in the build script so `dist/assets/*` mirrors `src/assets/*`.
const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, "..", "src", "assets");
const dest = path.join(root, "..", "dist", "assets");

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
  console.log(`Copied ${src} -> ${dest}`);
}
