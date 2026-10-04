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
      // In-place RSC refreshes leave stale screens on the office LAN (see
      // lib/reload-after-action.ts): reload/navigate, or render the action's
      // returned data, instead.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='refresh'][callee.object.name=/^router$/i]",
          message:
            "router.refresh() leaves stale screens on the office LAN. Use reloadAfterAction()/navigateAfterAction() from @/lib/reload-after-action, or render the action's returned data.",
        },
        {
          selector:
            "CallExpression[callee.property.name='refresh'][callee.object.callee.name='useRouter']",
          message:
            "useRouter().refresh() leaves stale screens on the office LAN. Use reloadAfterAction()/navigateAfterAction() from @/lib/reload-after-action.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/cache",
              importNames: ["refresh"],
              message:
                "Server-side refresh() fails on the office LAN like router.refresh(). Return data, or have the client call reloadAfterAction().",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
