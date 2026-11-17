import assert from "node:assert/strict";
import { ESLint } from "eslint";
import { test } from "vitest";

const eslint = new ESLint({
  // the typed rules need files on disk in the TypeScript project, and these sources exist only as text.
  overrideConfig: { languageOptions: { parserOptions: { projectService: false } } },
  ruleFilter: ({ ruleId }) => ruleId === "local/pascal-case-tsx" || ruleId === "no-restricted-syntax",
});

async function lint(filePath: string, source: string) {
  const [result] = await eslint.lintText(source, { filePath });

  return result.messages.map((m) => m.ruleId);
}

const component = "export function Component() {\n  return null;\n}\n";

test(".tsx filenames are PascalCase, apart from the entry file", async () => {
  for (const file of ["src/Input.tsx", "src/nested/HTTPStatus2.tsx", "Bootstrap.tsx", "src/main.tsx", "src/helper.ts"])
    assert.deepEqual(await lint(file, component), [], file);

  for (const file of ["src/input.tsx", "src/status-line.tsx", "src/nested/main.tsx", "invalid-root.tsx"])
    assert.deepEqual(await lint(file, component), ["local/pascal-case-tsx"], file);
});

test(".tsx files export components, hooks and types only", async () => {
  const allowed = [
    component,
    "export function useThing() {\n  return 1;\n}\n",
    "export const Component = () => null;\n",
    "export type Size = number;\n",
    "const Component = () => null;\n\nexport { Component };\n",
    "type Size = number;\n\nexport type { Size };\n",
  ];

  for (const source of allowed) assert.deepEqual(await lint("src/Thing.tsx", source), [], source);

  const helpers = [
    "export function helper() {\n  return 1;\n}\n",
    "export const limit = 1;\n",
    "const limit = 1;\n\nexport { limit };\n",
  ];

  for (const source of helpers) {
    assert.deepEqual(await lint("src/Thing.tsx", source), ["no-restricted-syntax"], source);
    assert.deepEqual(await lint("src/thing.ts", source), [], source);
  }
});
