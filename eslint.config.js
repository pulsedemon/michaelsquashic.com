import { basename } from "node:path";
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const pascalCaseTsx = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: { filename: "Use PascalCase for .tsx filenames." },
  },
  create(context) {
    return {
      Program(node) {
        if (!/^[A-Z][A-Za-z0-9]*\.tsx$/.test(basename(context.filename)))
          context.report({ node, messageId: "filename" });
      },
    };
  },
};

export default defineConfig(
  globalIgnores(["dist", "coverage", "docs/superpowers"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat["recommended-latest"],
    ],
    languageOptions: { parserOptions: { projectService: true } },
    plugins: { "@stylistic": stylistic },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
    rules: {
      "max-lines": ["error", 1500],
      "no-fallthrough": ["error", { allowEmptyCase: true }],
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        { blankLine: "any", prev: ["const", "let"], next: ["const", "let", "export"] },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      // an options object replaces the preset's whole, so the strict preset's other five are repeated.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowAny: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
        },
      ],
    },
  },
  {
    files: ["**/*.tsx"],
    // the entry file renders the page and is not a component.
    ignores: ["src/main.tsx"],
    plugins: { local: { rules: { "pascal-case-tsx": pascalCaseTsx } } },
    rules: { "local/pascal-case-tsx": "error" },
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...[
          "ExportNamedDeclaration > FunctionDeclaration[id.name!=/^([A-Z]|use[A-Z])/]",
          "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name!=/^([A-Z]|use[A-Z])/]",
          'ExportNamedDeclaration[exportKind="value"] > ExportSpecifier[exportKind!="type"][local.name!=/^([A-Z]|use[A-Z])/]',
        ].map((selector) => ({
          selector,
          message: "component files export components and hooks; move helpers and constants to a .ts module",
        })),
      ],
    },
  },
  {
    // Fiber is driven by mutating the three.js objects its hooks return.
    files: ["src/CrateCanvas.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
);
