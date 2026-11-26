import assert from "node:assert/strict";
import { test } from "vitest";
import { swipeScrub, swipeSettle } from "../swipe";

test("a drag across the whole stage moves 1.2 records against the finger, clamped to the ends", () => {
  assert.ok(Math.abs(swipeScrub(1, -402, 402, 4) - 2.2) < 1e-9);
  assert.equal(swipeScrub(0, 402, 402, 4), 0);
  assert.equal(swipeScrub(4, -402, 402, 4), 4);
});

test("a released drag lands on the next record past a small threshold, or further after a long drag", () => {
  assert.equal(swipeSettle(1, 1.1, 4), 1);
  assert.equal(swipeSettle(1, 1.2, 4), 2);
  assert.equal(swipeSettle(1, 0.85, 4), 0);
  assert.equal(swipeSettle(1, 2.4, 4), 2);
  assert.equal(swipeSettle(1, 2.7, 4), 3);
  assert.equal(swipeSettle(3, 1.4, 4), 1);
  assert.equal(swipeSettle(4, 4.3, 4), 4);
  assert.equal(swipeSettle(0.3, 0.1, 4), 0);
  // from between records the start rounds to 2, so a 0.2 pull back lands one record before it.
  assert.equal(swipeSettle(1.6, 1.4, 4), 1);
});
