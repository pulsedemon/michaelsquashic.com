import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { projects, screenshotSize, srcSet } from "../content";

/** a WebP file's pixel size, from its lossy (`VP8 `), lossless (`VP8L`) or extended (`VP8X`, lossy with alpha) header. */
function webpSize(path: string) {
  const b = readFileSync(path);
  const format = b.toString("latin1", 12, 16);

  if (format === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (format === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  if (format === "VP8L") {
    const bits = b.readUInt32LE(21);

    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`${path}: unexpected WebP format "${format}"`);
}

// the crate crops each picture by screenshotSize, so a wrong size draws the wrong part of the file.
test("every srcSet candidate is a file of the size screenshotSize gives", () => {
  for (const image of projects.flatMap((p) => p.images ?? [])) {
    for (const candidate of srcSet(image).split(", ")) {
      const url = candidate.split(" ")[0];

      assert.deepEqual(webpSize(`public${url}`), screenshotSize(url), url);
    }
  }
});
