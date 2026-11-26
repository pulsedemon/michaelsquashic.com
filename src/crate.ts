import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";

/** every record is this wide, in metres. */
const RECORD_W = 6;
export const FOV = 38;
const TAN_HALF_FOV = Math.tan((FOV * Math.PI) / 360);
/** the crate's proportions were tuned around a record 9.12 wide, and scale with the record. */
const S = RECORD_W / 9.12;
/** the distance between neighbouring slots. */
const PITCH = 0.7 * S;
/** how much wider the crate's inside is than a record. */
const INNER_MARGIN = 0.88 * S;
const WALL_T = 0.6 * S;
/** the walls' height as a share of a record's. */
const WALL_H_RATIO = 0.38;
/** the camera's direction from a record: x and z in record widths, y in record heights. */
const VIEW = { x: 0.4934, y: 1.224, z: 1.557 };
const LEAN_FORWARD = 0.8;
const LEAN_BACK = -0.16;
/** the black body behind each face, and the gap between them. */
export const BODY_DEPTH = 0.12;
export const BODY_GAP = 0.001;
/** pivots sit this far above the floor, so a record leaning back clears it. */
const PIVOT_LIFT = 0.03;
/** the inner face of the front wall. */
const FRONT_Z = -2;
/** clearance kept between a leaning record and the crate's front and back walls. */
const CLEAR = 0.3;
/** the sun comes from the upper left. */
const SUN = new Vector3(-10, 20, 14).normalize();

type Size = { width: number; height: number };
/**
 * where the bar leaves room for the records, in CSS px from the canvas's top left: `floor`, the lowest the records reach,
 * which is the bar's top, or its bottom when it stands down the right side from `sideLeft`; and the height kept clear above them.
 */
type Hud = { floor: number; topInset: number; sideLeft?: number };
/** the grid's computed track sizes, in CSS px. */
type Tracks = { column: number; row: number };

/** a record's pose: its pivot at the face's bottom edge, its lean about x and its face size. */
type RecordState = { x: number; y: number; z: number; rot: number; w: number; h: number };
type CameraState = { position: Vector3; quaternion: Quaternion };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (x: number) => x * x * (3 - 2 * x);

/** how quickly the records catch up with the scroll: the easing's time constant, in seconds. */
const EASE = 0.08;

/**
 * the scrub position the records are drawn at, one frame of `delta` seconds closer to the scroll's.
 * `delta` is capped because the first frame after the scene rests spans the whole idle gap.
 */
export function easeScrub(from: number, to: number, delta: number) {
  const next = from + (to - from) * (1 - Math.exp(-Math.min(delta, 1 / 30) / EASE));

  return Math.abs(to - next) < 0.001 ? to : next;
}

/** a record's lean at scrub position `p`: records before `p` tip forward out of the way, the rest lean back. */
function lean(i: number, p: number) {
  const f = smoothstep(clamp01(p - i));

  return f * LEAN_FORWARD + (1 - f) * LEAN_BACK;
}

type Box = { center: [number, number, number]; size: [number, number, number] };

/** the crate for one viewport: record size, crate geometry and placement, slots, camera stops, ground and shadow bounds. */
export function crateLayout(canvas: Size, tracks: Tracks, hud: Hud, n: number): Layout {
  const { crateOrigin, ...base } = crateBase(canvas, tracks, hud, n);
  const stops = Array.from({ length: n }, (_, i) => fitStop(base, i));
  const casterPoints: Vector3[] = [];

  for (let i = 0; i < n; i++)
    for (let j = 0; j <= 10 * base.last; j++) casterPoints.push(...recordCorners(recordPose(i, j / 10, base)));
  for (const b of base.boxes) casterPoints.push(...boxCorners(b));
  const ground = groundFor(casterPoints, base.groundY);
  const sun = sunFor(casterPoints, ground, crateOrigin);

  return { ...base, stops, ground, sun, room: roomFor(base, stops) };
}

/**
 * CSS px the scene draws past the stage: above it at the first stop, which is what scrolls in, and below it at the
 * last, which is what scrolls out. shadows count, by the footprints of the corners that cast them. `clear` is the
 * empty height above the scene at the first stop.
 */
function roomFor(l: LayoutBase, stops: CameraState[]) {
  const reach = (p: number) => {
    const points = [
      ...Array.from({ length: l.n }, (_, i) => recordCorners(recordPose(i, p, l))).flat(),
      ...l.boxes.flatMap(boxCorners),
    ];
    const shadows = points.filter((pt) => pt.y >= l.groundY).map((pt) => shadowOf(pt, l.groundY));

    return project([...points, ...shadows], stops[p], l.canvas.width / l.canvas.height).map((q) => q.y);
  };
  const px = (ndc: number) => Math.max(0, Math.ceil((ndc / 2) * l.canvas.height));
  const top = Math.max(...reach(0));

  return {
    above: px(top - 1),
    below: px(-1 - Math.min(...reach(l.last))),
    clear: Math.max(0, Math.floor(((1 - top) / 2) * l.canvas.height)),
  };
}

/** where the sun casts a point onto the ground at height `y`. */
function shadowOf(p: Vector3, y: number) {
  return p.clone().addScaledVector(SUN, -(p.y - y) / SUN.y);
}

/** everything about the crate that depends only on the viewport, the grid's tracks and the HUD. */
function crateBase(canvas: Size, tracks: Tracks, hud: Hud, n: number) {
  const last = n - 1;
  const H = tracks.row * (RECORD_W / tracks.column);
  const innerW = RECORD_W + INNER_MARGIN;
  const h = WALL_H_RATIO * H;
  // a record tipped forward keeps CLEAR from the front wall's top inner edge, measured from its face's plane.
  const front = (CLEAR + Math.sin(LEAN_FORWARD) * (h - PIVOT_LIFT)) / Math.cos(LEAN_FORWARD);
  const back = H * Math.sin(-LEAN_BACK) + (BODY_DEPTH + BODY_GAP) * Math.cos(LEAN_BACK) + CLEAR;
  const slotZ = Array.from({ length: n }, (_, i) => FRONT_Z - front - i * PITCH);
  const backZ = slotZ[last] - back;
  const frontOuter = FRONT_Z + WALL_T;
  const x0 = innerW / 2;
  const zMid = (frontOuter + backZ - WALL_T) / 2;
  const zLen = frontOuter - (backZ - WALL_T);
  // the floor's top is at y = 0.
  const boxes: Box[] = [
    { center: [0, -WALL_T / 2, zMid], size: [innerW + 2 * WALL_T, WALL_T, zLen] },
    { center: [0, h / 2, FRONT_Z + WALL_T / 2], size: [innerW + 2 * WALL_T, h, WALL_T] },
    { center: [0, h / 2, backZ - WALL_T / 2], size: [innerW + 2 * WALL_T, h, WALL_T] },
    { center: [-x0 - WALL_T / 2, h / 2, (FRONT_Z + backZ) / 2], size: [WALL_T, h, FRONT_Z - backZ] },
    { center: [x0 + WALL_T / 2, h / 2, (FRONT_Z + backZ) / 2], size: [WALL_T, h, FRONT_Z - backZ] },
  ];
  const groundY = -WALL_T;
  const crateOrigin = new Vector3(0, groundY, zMid);

  return { canvas, hud, n, last, W: RECORD_W, H, slotZ, boxes, crateOrigin, groundY };
}

type LayoutBase = Omit<ReturnType<typeof crateBase>, "crateOrigin">;
export type Layout = LayoutBase & {
  stops: CameraState[];
  ground: ReturnType<typeof groundFor>;
  sun: ReturnType<typeof sunFor>;
  room: ReturnType<typeof roomFor>;
};

/** the 8 corners of a record's face-and-body box in world space. */
export function recordCorners(r: RecordState): Vector3[] {
  const c = Math.cos(r.rot);
  const s = Math.sin(r.rot);
  const back = -(BODY_GAP + BODY_DEPTH);
  const out: Vector3[] = [];

  for (const lx of [-r.w / 2, r.w / 2])
    for (const ly of [0, r.h])
      for (const lz of [0, back]) out.push(new Vector3(r.x + lx, r.y + ly * c - lz * s, r.z + ly * s + lz * c));

  return out;
}

function boxCorners(b: Box): Vector3[] {
  const out: Vector3[] = [];

  for (const dx of [-0.5, 0.5])
    for (const dy of [-0.5, 0.5])
      for (const dz of [-0.5, 0.5])
        out.push(new Vector3(b.center[0] + dx * b.size[0], b.center[1] + dy * b.size[1], b.center[2] + dz * b.size[2]));

  return out;
}

/** the ground plane covers every caster's shadow footprint and the crate, so no shadow falls off its edge. */
function groundFor(points: Vector3[], y: number) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  const take = (x: number, z: number) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  };

  for (const p of points) {
    if (p.y < y) continue;
    const s = shadowOf(p, y);

    take(s.x, s.z);
  }
  // sampling p in tenths, and corners near the ground's level, leave footprints a little past the sampled ones.
  const pad = 1.5;

  return {
    y,
    center: [(x0 + x1) / 2, y, (z0 + z1) / 2] as [number, number, number],
    size: [x1 - x0 + 2 * pad, z1 - z0 + 2 * pad] as [number, number],
  };
}

/** the sun and its orthographic shadow camera, bounding every caster and the ground in the light's view. */
function sunFor(points: Vector3[], ground: ReturnType<typeof groundFor>, target: Vector3) {
  // beyond every caster along the light, so none sits behind the shadow camera.
  const reach = Math.max(...points.map((p) => p.clone().sub(target).dot(SUN)));
  const position = target.clone().addScaledVector(SUN, Math.max(60, reach + 5));
  const view = new Matrix4()
    .lookAt(position, target, new Vector3(0, 1, 0))
    .setPosition(position)
    .invert();
  const all = [...points];

  for (const dx of [-0.5, 0.5])
    for (const dz of [-0.5, 0.5])
      all.push(new Vector3(ground.center[0] + dx * ground.size[0], ground.y, ground.center[2] + dz * ground.size[1]));
  let l = Infinity;
  let r = -Infinity;
  let b = Infinity;
  let t = -Infinity;
  let near = Infinity;
  let far = -Infinity;

  for (const p of all) {
    const v = p.clone().applyMatrix4(view);

    l = Math.min(l, v.x);
    r = Math.max(r, v.x);
    b = Math.min(b, v.y);
    t = Math.max(t, v.y);
    near = Math.min(near, -v.z);
    far = Math.max(far, -v.z);
  }
  const pad = 0.25;

  return {
    position,
    target: target.clone(),
    left: l - pad,
    right: r + pad,
    bottom: b - pad,
    top: t + pad,
    near: Math.max(0.1, near - 1),
    far: far + 1,
  };
}

/** where record `i` rests at scrub position `p`. */
export function recordPose(i: number, p: number, l: Pick<Layout, "slotZ" | "W" | "H">): RecordState {
  return { x: 0, y: PIVOT_LIFT, z: l.slotZ[i], rot: lean(i, p), w: l.W, h: l.H };
}

const UP = new Vector3(0, 1, 0);

function lookFrom(position: Vector3, target: Vector3): Quaternion {
  return new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, UP));
}

/**
 * the fit box in normalised device coordinates: from 8% of the width to 92% of it, or to 4% short of a side bar, and between
 * the top inset and the floor less 4% of the height each.
 */
function fitBox(canvas: Size, hud: Hud) {
  const vh = canvas.height;
  const y = (px: number) => 1 - (2 * px) / vh;
  const right = hud.sideLeft === undefined ? 0.84 : (2 * (hud.sideLeft - 0.04 * canvas.width)) / canvas.width - 1;

  return { left: -0.84, right, top: y(hud.topInset + 0.04 * vh), bottom: y(hud.floor - 0.04 * vh) };
}

const projector = new PerspectiveCamera(FOV, 1, 0.1, 1000);

/** projects world points through a camera pose into normalised device coordinates. */
export function project(points: Vector3[], camera: CameraState, aspect: number) {
  projector.aspect = aspect;
  projector.updateProjectionMatrix();
  projector.position.copy(camera.position);
  projector.quaternion.copy(camera.quaternion);
  projector.updateMatrixWorld(true);

  return points.map((p) => {
    const v = p.clone().applyMatrix4(projector.matrixWorldInverse);
    const behind = v.z >= -0.1;

    v.applyMatrix4(projector.projectionMatrix);

    return { x: v.x, y: v.y, behind };
  });
}

/**
 * the camera stop that frames record `i` leaning back: seen along `VIEW`, centred in the fit box,
 * at the smallest distance that keeps all eight corners inside it. shallow records bring the record leaning forward in
 * front up to that sight line, so the camera rises until it clears the low line by 2°.
 */
function fitStop(l: LayoutBase, i: number): CameraState {
  const pose = recordPose(i, i, l);
  const low = lowLine(pose);
  const heading = new Vector3(VIEW.x, 0, VIEW.z).normalize();
  const along = (elevation: number) =>
    fitAlong(l, pose, heading.clone().multiplyScalar(Math.cos(elevation)).setY(Math.sin(elevation)));
  const need = Math.atan(clearSlope(l)) + (2 * Math.PI) / 180;
  let elevation = Math.atan2(VIEW.y * l.H, Math.hypot(VIEW.x, VIEW.z) * l.W);
  let stop = along(elevation);

  for (let pass = 0; pass < 20; pass++) {
    const sight = Math.atan2(stop.position.y - low.y, stop.position.z - low.z);

    if (sight >= need - 1e-9) break;
    elevation += need - sight;
    stop = along(elevation);
  }

  return stop;
}

/** the camera along `dir` from a record, as close as the fit box allows, with the record centred in it. */
function fitAlong(l: LayoutBase, pose: RecordState, dir: Vector3): CameraState {
  const box = fitBox(l.canvas, l.hud);
  const aspect = l.canvas.width / l.canvas.height;
  const corners = recordCorners(pose);
  const up = new Vector3(0, Math.cos(pose.rot), Math.sin(pose.rot));
  const right = new Vector3(1, 0, 0);
  const target = new Vector3(pose.x, pose.y, pose.z).addScaledVector(up, pose.h / 2);
  const at = (d: number) => {
    const position = target.clone().addScaledVector(dir, d);

    return { position, quaternion: lookFrom(position, target) };
  };
  const fits = (d: number) =>
    project(corners, at(d), aspect).every(
      (c) => !c.behind && c.x >= box.left && c.x <= box.right && c.y <= box.top && c.y >= box.bottom,
    );
  let d = 1;

  for (let pass = 0; pass < 10; pass++) {
    let lo = 0.5;
    let hi = 500;

    for (let j = 0; j < 60; j++) {
      const mid = (lo + hi) / 2;

      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    d = hi;
    const pts = project(corners, at(d), aspect);
    const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
    const cy = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
    const ox = (box.left + box.right) / 2 - cx;
    const oy = (box.top + box.bottom) / 2 - cy;

    if (Math.abs(ox) < 1e-5 && Math.abs(oy) < 1e-5) break;
    // moving the target left moves the record right on screen.
    target.addScaledVector(right, -ox * d * TAN_HALF_FOV * aspect);
    target.addScaledVector(up, -oy * d * TAN_HALF_FOV);
  }

  return at(d);
}

/** a point on the line 10% up a record's face, the lowest one its stop has to show. */
function lowLine(r: RecordState) {
  return new Vector3(r.x, r.y, r.z).addScaledVector(new Vector3(0, Math.cos(r.rot), Math.sin(r.rot)), 0.1 * r.h);
}

/** the y-z slope from a record's low line to the top of the record leaning forward in front of it; every stop is alike. */
function clearSlope(l: LayoutBase) {
  const front = recordPose(0, 1, l);
  const top = new Vector3(front.x, front.y, front.z).addScaledVector(
    new Vector3(0, Math.cos(front.rot), Math.sin(front.rot)),
    front.h,
  );
  const low = lowLine(recordPose(1, 1, l));

  return (top.y - low.y) / (top.z - low.z);
}

/** the camera at scrub position `p`: between the stops either side, lerped in position and slerped in rotation. */
export function stopPose(p: number, l: Pick<Layout, "stops" | "last">): CameraState {
  const q = Math.min(l.last, Math.max(0, p));
  const a = Math.floor(q);
  const b = Math.min(l.last, a + 1);
  const f = q - a;

  return {
    position: l.stops[a].position.clone().lerp(l.stops[b].position, f),
    quaternion: l.stops[a].quaternion.clone().slerp(l.stops[b].quaternion, f),
  };
}
