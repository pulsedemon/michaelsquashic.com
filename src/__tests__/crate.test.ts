import assert from "node:assert/strict";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { test } from "vitest";
import { projects } from "../content";
import { crateLayout, easeScrub, FOV, type Layout, recordCorners, recordPose, stopPose } from "../crate";

type Hud = Parameters<typeof crateLayout>[2];

// measured from the live page in Chrome at each size: the stage, the grid's tracks and the bar, which stands down the right side on a phone held sideways.
const measured: { canvas: { width: number; height: number }; tracks: { column: number; row: number }; hud: Hud }[] = [
  {
    canvas: { width: 1440, height: 900 },
    tracks: { column: 630.5, row: 548.141 },
    hud: { floor: 792, topInset: 108 },
  },
  {
    canvas: { width: 700, height: 900 },
    tracks: { column: 616, row: 535.922 },
    hud: { floor: 819.625, topInset: 80.4 },
  },
  { canvas: { width: 500, height: 727 }, tracks: { column: 440, row: 387.672 }, hud: { floor: 595, topInset: 76 } },
  {
    canvas: { width: 874, height: 402 },
    tracks: { column: 371.219, row: 330.234 },
    hud: { floor: 402, topInset: 89.448, sideLeft: 594 },
  },
];
// synthetic: records this shallow make the camera rise to see past the record leaning forward in front.
const shallow: (typeof measured)[number] = {
  canvas: { width: 1440, height: 900 },
  tracks: { column: 640, row: 300 },
  hud: { floor: 820, topInset: 70 },
};
const fixtures = [...measured, shallow];

type Fixture = (typeof fixtures)[number];
const n = projects.length;

const name = (f: Fixture) => `${f.canvas.width}x${f.canvas.height}, ${f.tracks.column}x${f.tracks.row} tracks`;
const layoutFor = (f: Fixture) => crateLayout(f.canvas, f.tracks, f.hud, n);

/** screen pixels, y down, through a camera built from the stop. */
function toScreen(points: Vector3[], stop: Layout["stops"][number], { width, height }: Fixture["canvas"]) {
  const camera = new PerspectiveCamera(FOV, width / height, 0.1, 1000);

  camera.position.copy(stop.position);
  camera.quaternion.copy(stop.quaternion);
  camera.updateMatrixWorld();

  return points.map((p) => {
    const ndc = p.clone().project(camera);

    return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height };
  });
}

for (const f of fixtures) {
  test(`every stop frames its record between the top inset and the bar at ${name(f)}`, () => {
    const layout = layoutFor(f);
    const { width, height } = f.canvas;
    const box = {
      left: 0.08 * width,
      right: f.hud.sideLeft === undefined ? 0.92 * width : f.hud.sideLeft - 0.04 * width,
      top: f.hud.topInset + 0.04 * height,
      bottom: f.hud.floor - 0.04 * height,
    };

    for (let i = 0; i < n; i++) {
      const px = toScreen(recordCorners(recordPose(i, i, layout)), layout.stops[i], f.canvas);
      const xs = px.map((c) => c.x);
      const ys = px.map((c) => c.y);
      const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

      assert.ok(
        left >= box.left - 0.5 && right <= box.right + 0.5,
        `record ${i} spans x ${left}..${right}, box ${box.left}..${box.right}`,
      );
      assert.ok(
        top >= box.top - 0.5 && bottom <= box.bottom + 0.5,
        `record ${i} spans y ${top}..${bottom}, box ${box.top}..${box.bottom}`,
      );
      // as close as the box allows: the record fills it on one axis.
      const fillsWidth = left - box.left < 1 && box.right - right < 1;
      const fillsHeight = top - box.top < 1 && box.bottom - bottom < 1;

      assert.ok(fillsWidth || fillsHeight, `record ${i} fills neither axis of the box`);
    }
  });

  test(`the record leaning forward stays below the shown record's lowest line at ${name(f)}`, () => {
    const layout = layoutFor(f);

    for (let i = 1; i < n; i++) {
      const corners = recordCorners(recordPose(i - 1, i, layout));
      // the face's top edge; the body behind it sits higher by design.
      const frontTop = [corners[2], corners[6]];
      const r = recordPose(i, i, layout);
      const up = new Vector3(0, Math.cos(r.rot), Math.sin(r.rot)).multiplyScalar(0.1 * r.h);
      const low = [new Vector3(r.x - r.w / 2, r.y, r.z).add(up), new Vector3(r.x + r.w / 2, r.y, r.z).add(up)];
      const [a, b, ...tops] = toScreen([...low, ...frontTop], layout.stops[i], f.canvas);

      for (const t of tops) {
        // with y down and a running left to right, a positive cross product puts t below the line.
        const cross = (b.x - a.x) * (t.y - a.y) - (b.y - a.y) * (t.x - a.x);

        assert.ok(cross > 0, `record ${i - 1}'s top covers record ${i}'s lowest line`);
      }
    }
  });

  test(`the room above and below the stage holds the scene as it scrolls in and out at ${name(f)}`, () => {
    const layout = layoutFor(f);
    const sun = layout.sun.position.clone().sub(layout.sun.target).normalize();
    const boxCorners = layout.boxes.flatMap(({ center: [x, y, z], size: [w, h, d] }) =>
      [-0.5, 0.5].flatMap((dx) =>
        [-0.5, 0.5].flatMap((dy) => [-0.5, 0.5].map((dz) => new Vector3(x + dx * w, y + dy * h, z + dz * d))),
      ),
    );
    const scene = (p: number) => {
      const points = [
        ...Array.from({ length: n }, (_, i) => recordCorners(recordPose(i, p, layout))).flat(),
        ...boxCorners,
      ];
      const shadows = points.map((pt) => pt.clone().addScaledVector(sun, -(pt.y - layout.groundY) / sun.y));

      return [...points, ...shadows];
    };
    const highest = Math.min(...toScreen(scene(0), layout.stops[0], f.canvas).map((c) => c.y));
    const lowest = Math.max(...toScreen(scene(n - 1), layout.stops[n - 1], f.canvas).map((c) => c.y));

    assert.ok(
      highest >= -layout.room.above - 0.5,
      `the scene reaches ${-highest}px above the stage, room ${layout.room.above}px`,
    );
    assert.ok(
      lowest <= f.canvas.height + layout.room.below + 0.5,
      `the scene reaches ${lowest - f.canvas.height}px below the stage, room ${layout.room.below}px`,
    );
    // the canvas rises by `clear` while the stage scrolls in: any more runs the scene into the Work heading, any less leaves a gap.
    const top = Math.max(0, highest);

    assert.ok(
      layout.room.clear <= top + 0.5 && layout.room.clear > top - 1.5,
      `the scene starts ${top}px below the stage, clear ${layout.room.clear}px`,
    );
  });
}

test("the camera blends between stops, clamped to the first and last", () => {
  const turn = (degrees: number) =>
    new Quaternion(0, Math.sin((degrees * Math.PI) / 360), 0, Math.cos((degrees * Math.PI) / 360));
  const stops = [
    { position: new Vector3(0, 0, 0), quaternion: turn(0) },
    { position: new Vector3(4, 8, -12), quaternion: turn(120) },
  ];
  const l = { stops, last: 1 };

  const quarter = stopPose(0.25, l);

  assert.deepEqual(quarter.position.toArray(), [1, 2, -3]);
  // a normalised lerp gives about 27.8° here, and swapped stops 90°.
  const off = (quarter.quaternion.angleTo(turn(30)) * 180) / Math.PI;

  assert.ok(off < 0.5, `the camera is ${off}° off its 30° turn`);

  assert.deepEqual(stopPose(-1, l).position.toArray(), [0, 0, 0]);
  assert.ok(stopPose(-1, l).quaternion.angleTo(turn(0)) < 1e-9);
  assert.deepEqual(stopPose(2, l).position.toArray(), [4, 8, -12]);
  assert.ok(stopPose(2, l).quaternion.angleTo(turn(120)) < 1e-9);
  assert.deepEqual(stops[0].position.toArray(), [0, 0, 0]);
  assert.deepEqual(stops[1].position.toArray(), [4, 8, -12]);
  assert.ok(stops[0].quaternion.angleTo(turn(0)) < 1e-9);
});

test("the records close all but 1/e of the gap to the scroll in 80 ms, at any frame rate", () => {
  const after = (frames: number, delta: number) =>
    Array.from({ length: frames }).reduce<number>((p) => easeScrub(p, 1, delta), 0);

  assert.ok(Math.abs(after(8, 0.01) - (1 - 1 / Math.E)) < 1e-9, `8 frames of 10 ms reach ${after(8, 0.01)}`);
  assert.ok(Math.abs(after(16, 0.005) - (1 - 1 / Math.E)) < 1e-9, `16 frames of 5 ms reach ${after(16, 0.005)}`);
});

test("a frame after a long rest moves the records no further than a thirtieth of a second does", () => {
  assert.equal(easeScrub(0, 1, 10), easeScrub(0, 1, 1 / 30));
  assert.ok(easeScrub(0, 1, 10) < 0.35);
});

test("the records land exactly on the scroll's position, 34 frames after a one-record jump at 60 Hz", () => {
  let p = 2;
  let frames = 0;

  while (p !== 3 && frames < 100) {
    p = easeScrub(p, 3, 1 / 60);
    frames++;
  }
  assert.equal(frames, 34);
});
