import assert from "node:assert/strict";
import { test } from "vitest";
import { must } from "../must";

test("must returns a value that is there, falsy ones included", () => {
  for (const value of [0, "", false, "a"]) assert.equal(must(value), value);
});

test("must throws on null and undefined", () => {
  assert.throws(() => must(null));
  assert.throws(() => must(undefined));
});
