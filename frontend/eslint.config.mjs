import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Event imagery comes from arbitrary scraped hosts, so next/image is the
    // wrong tool for it: the optimizer would need a wildcard remotePatterns
    // and a dead source host would fail the request instead of degrading to an
    // empty tile. Plain <img> plus aspect-ratio in CSS keeps layout stable and
    // keeps a broken remote image from taking a card down with it.
    files: ["src/**/*.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
