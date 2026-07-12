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
    // Build output inside Claude worktrees (root ".next/**" only matches the top level):
    "**/.next/**",
    ".claude/**",
    // Generated code and local tool state:
    "app/generated/**",
    "graphify-out/**",
    "dist/**",
    "coverage/**",
    // Static assets, including the vendored minified pdf.js worker:
    "public/**",
  ]),
  {
    rules: {
      // Underscore prefix marks intentionally unused params/vars (e.g. exhaustive
      // switch guards, destructuring to drop a key).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
