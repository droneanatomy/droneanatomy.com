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
    /* STATIC ASSETS, NOT SOURCE. public/ is served verbatim; nothing in it
       is compiled or imported, so linting it only ever reports on other
       people's code. It was reporting nine errors from the vendored Draco
       decoder — a require() shim, an assignment to `module`, and four
       aliases of `this` — none of which we can or should change. */
    "public/**",
  ]),
]);

export default eslintConfig;
