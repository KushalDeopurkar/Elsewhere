/**
 * MapLibre loads its tile worker from a separate .mjs chunk. Turbopack does
 * not trace that import, so the bundled app asks for a worker URL that does
 * not exist and the map dies with "Worker failed to load."
 *
 * Copying the shipped worker into public/ and pointing setWorkerUrl at it is
 * the supported escape hatch. Runs before dev and build so it cannot drift
 * from the installed maplibre-gl version.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkg = require.resolve("maplibre-gl/package.json");
const src = join(dirname(pkg), "dist", "maplibre-gl-worker.mjs");
const destDir = join(process.cwd(), "public");
const dest = join(destDir, "maplibre-gl-worker.mjs");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("copied maplibre worker ->", dest);
