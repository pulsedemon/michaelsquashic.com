import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type RefObject } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  LinearFilter,
  Object3D,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type PerspectiveCamera,
  type Texture,
} from "three";
import type { Area, CardShot, Snapshot } from "./cardCapture";
import { projects, screenshotSize } from "./content";
import {
  BODY_DEPTH,
  BODY_GAP,
  easeScrub,
  FOV,
  project,
  recordCorners,
  recordPose,
  stopPose,
  type Layout,
} from "./crate";
import { must } from "./must";

/** the stylesheet's one-column breakpoint, where a record draws its picture's `phoneCrop`. */
const phone = matchMedia("(max-width: 760px)");
const phoneCrops = new Map(projects.flatMap((p) => p.images ?? []).map((image) => [image.src, image.phoneCrop]));

/** Fiber's DPR range, which the canvas and the textures both use. */
const DPR: [min: number, max: number] = [1, 2];
const canvasDpr = () => Math.min(Math.max(devicePixelRatio, DPR[0]), DPR[1]);

/** draws a card at `scale` texels per CSS pixel on the page's own grey. */
function cardTexture(shot: CardShot, scale: number, mipmaps: boolean) {
  const canvas = document.createElement("canvas");

  canvas.width = Math.ceil(shot.rect.width * scale);
  canvas.height = Math.ceil(shot.rect.height * scale);
  const g = must(canvas.getContext("2d"));

  g.scale(scale, scale);
  g.fillStyle = shot.background;
  g.fillRect(0, 0, shot.rect.width, shot.rect.height);
  for (const f of shot.fills) {
    g.fillStyle = f.color;
    g.fillRect(f.x, f.y, f.width, f.height);
  }
  for (const p of shot.pictures) {
    if ("svg" in p) {
      // filled as paths: WebKit shrinks an SVG image that `drawImage` crops.
      const box = p.svg.viewBox.baseVal;

      for (const polygon of p.svg.querySelectorAll("polygon")) {
        g.fillStyle = getComputedStyle(polygon).fill;
        g.beginPath();
        for (const { x, y } of polygon.points)
          g.lineTo(p.x + (x * p.width) / box.width, p.y + (y * p.height) / box.height);
        g.fill();
      }
      continue;
    }
    // `drawImage` crops in the file's pixels; with `srcset` the natural size is scaled to `sizes` and rounded.
    const file = p.img.srcset
      ? screenshotSize(new URL(p.img.currentSrc).pathname)
      : { width: p.img.naturalWidth, height: p.img.naturalHeight };
    const crop = phone.matches ? phoneCrops.get(p.img.getAttribute("src") ?? "") : undefined;

    if (crop) {
      const sw = crop.width * file.width;

      g.drawImage(
        p.img,
        crop.x * file.width,
        crop.y * file.height,
        sw,
        (sw * p.height) / p.width,
        p.x,
        p.y,
        p.width,
        p.height,
      );
      continue;
    }
    const fit = Math.max(p.width / file.width, p.height / file.height);
    const sw = p.width / fit;
    const sh = p.height / fit;

    g.drawImage(p.img, (file.width - sw) / 2, (file.height - sh) / 2, sw, sh, p.x, p.y, p.width, p.height);
  }
  g.textBaseline = "alphabetic";
  for (const { ch, x, baseline, font, color } of shot.glyphs) {
    g.font = font;
    g.fillStyle = color;
    g.fillText(ch, x, baseline);
  }
  for (const u of shot.underlines) {
    g.fillStyle = u.color;
    g.fillRect(u.x, u.y, u.width, u.thickness);
  }
  const texture = new CanvasTexture(canvas);

  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  if (!mipmaps) {
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
  }

  return texture;
}

type CrateSceneProps = {
  snapshot: Snapshot;
  layout: Layout;
  reducedMotion: boolean;
  /** the scrub position, which the scene reads every frame. */
  scrub: RefObject<number>;
  frameloop: "always" | "demand" | "never";
  /** takes the clicks on the records, since the canvas lets them through to the page. */
  stage: RefObject<HTMLElement | null>;
  /** called on the frame the canvas first shows. */
  onRevealed: () => void;
};

type CrateCanvasProps = Omit<CrateSceneProps, "snapshot" | "layout"> & {
  /** null until the cards are captured, so the context is created while their pictures load. */
  scene: Pick<CrateSceneProps, "snapshot" | "layout"> | null;
};

export function CrateCanvas({ scene, ...props }: CrateCanvasProps) {
  const { above = 0, below = 0, clear = 0 } = scene?.layout.room ?? {};

  return (
    <Canvas
      dpr={DPR}
      flat
      shadows="percentage"
      frameloop={props.frameloop}
      resize={{ scroll: false }}
      // manual, because the scene sets the aspect from the stage and Fiber would set it from the taller canvas.
      camera={{ fov: FOV, near: 0.1, far: 1000, manual: true }}
      className="crate-scene"
      // laid out in the stage, so the browser scrolls it in and out with the page. taller than the stage by what the scene draws past it.
      style={
        {
          "--settle": `${clear}px`,
          position: "absolute",
          top: -above,
          left: 0,
          width: "100%",
          height: `calc(100% + ${above + below}px)`,
          zIndex: 1,
          pointerEvents: "none",
        } as CSSProperties
      }
      aria-hidden
      // hidden until the reveal frame, which comes after every texture, the compile and the shadow pass's warm-up.
      onCreated={({ gl }) => void (gl.domElement.style.visibility = "hidden")}
    >
      {scene && <CrateScene {...props} {...scene} />}
    </Canvas>
  );
}

const unitPlane = new PlaneGeometry(1, 1);
const unitBox = new BoxGeometry(1, 1, 1);

function CrateScene(props: CrateSceneProps) {
  const { reducedMotion, snapshot, layout, scrub } = props;
  const { gl, camera, scene, invalidate } = useThree();
  const latest = useRef(props);

  useLayoutEffect(() => {
    latest.current = props;
  });
  const n = snapshot.length;

  const groups = useRef<(Group | null)[]>([]);
  const faces = useRef<(Mesh | null)[]>([]);
  const sunTarget = useMemo(() => new Object3D(), []);
  const textures = useRef<(Texture | null)[]>([]);

  /** the scrub position the records are drawn at, which trails the scroll's. */
  const eased = useRef<number | null>(null);

  useLayoutEffect(() => {
    eased.current = null;
    invalidate();
  }, [reducedMotion, invalidate]);

  const state = useRef({
    compileStarted: false,
    compiled: false,
    warmed: false,
    revealed: false,
  });

  // textures sized for each record's projected width at its stop, built one per frame.
  const textureQueue = useRef<number[]>([]);

  function textureWidth(i: number) {
    const corners = recordCorners(recordPose(i, i, layout));
    const { width, height } = layout.canvas;
    const pts = project(corners, layout.stops[i], width / height);
    const widthCss = ((Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))) / 2) * width;

    return Math.min(2048, widthCss * canvasDpr());
  }
  function buildTexture(i: number) {
    const shot = snapshot[i];
    const width = textureWidth(i);
    const old = textures.current[i];

    // no wider than the card on the page: the card's own scale already has every texel the stop can show.
    textures.current[i] =
      width <= Math.ceil(shot.rect.width * canvasDpr())
        ? cardTexture(shot, canvasDpr(), false)
        : cardTexture(shot, width / shot.rect.width, true);
    gl.initTexture(textures.current[i]);
    old?.dispose();
  }

  // each capture or layout rebuilds every texture; before the reveal, the scene waits for them again.
  useLayoutEffect(() => {
    // current record first; each old texture keeps drawing until its replacement is ready.
    const first = Math.round(scrub.current);

    textureQueue.current = snapshot.map((_, i) => i).sort((a, b) => Math.abs(a - first) - Math.abs(b - first));
    invalidate();
  }, [snapshot, layout, scrub, invalidate]);

  useEffect(() => () => textures.current.forEach((t) => t?.dispose()), []);

  // three.js rebuilds a restored context without drawing, and demand rendering waits for a request.
  useEffect(() => {
    const canvas = gl.domElement;
    const redraw = () => invalidate();

    canvas.addEventListener("webglcontextrestored", redraw);

    return () => canvas.removeEventListener("webglcontextrestored", redraw);
  }, [gl, invalidate]);

  // clicking a record's picture or title opens its case study.
  useEffect(() => {
    const stage = must(props.stage.current);
    const raycaster = new Raycaster();

    /** the case-study link whose picture or title is drawn frontmost at the event's point. */
    function linkAt(e: MouseEvent) {
      if (!state.current.revealed || (e.target as Element).closest("a, button")) return null;
      const canvas = gl.domElement.getBoundingClientRect();

      raycaster.setFromCamera(
        new Vector2(
          ((e.clientX - canvas.left) / canvas.width) * 2 - 1,
          1 - ((e.clientY - canvas.top) / canvas.height) * 2,
        ),
        camera,
      );
      const hit = raycaster.intersectObjects(scene.children).at(0);

      if (!hit?.uv) return null;
      const i = faces.current.findIndex((face) => face === hit.object);

      if (i < 0) return null;
      const shot = latest.current.snapshot[i];
      const x = hit.uv.x * shot.rect.width;
      const y = (1 - hit.uv.y) * shot.rect.height;
      const on = (a: Area) => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height;

      return shot.pictures.some(on) || on(shot.title) ? shot.title.link : null;
    }
    const hover = (e: PointerEvent) => void (stage.style.cursor = linkAt(e) ? "pointer" : "");
    // replayed on the page card's link, so modifier keys and the middle button open tabs and windows as on any link.
    // Chrome follows a link on a synthetic click with the middle button but not on a synthetic auxclick.
    const open = (e: MouseEvent) => void linkAt(e)?.dispatchEvent(new MouseEvent("click", e));
    const openMiddle = (e: MouseEvent) => {
      if (e.button === 1) open(e);
    };

    stage.addEventListener("pointermove", hover);
    stage.addEventListener("click", open);
    stage.addEventListener("auxclick", openMiddle);

    return () => {
      stage.removeEventListener("pointermove", hover);
      stage.removeEventListener("click", open);
      stage.removeEventListener("auxclick", openMiddle);
      stage.style.cursor = "";
    };
  }, [props.stage, gl, camera, scene]);

  // a stopped loop leaves its last frame on the canvas, so it hides until the next frame draws.
  useEffect(() => {
    if (props.frameloop === "never") gl.domElement.style.visibility = "hidden";
  }, [props.frameloop, gl]);

  function worldPose(p: number) {
    for (let i = 0; i < n; i++) {
      const g = groups.current[i];
      const face = faces.current[i];

      if (!g || !face) continue;
      const r = recordPose(i, p, layout);

      g.position.set(r.x, r.y, r.z);
      g.rotation.set(r.rot, 0, 0);
      (face.material as MeshBasicMaterial).map = textures.current[i];
    }
    const cam = stopPose(p, layout);

    camera.position.copy(cam.position);
    camera.quaternion.copy(cam.quaternion);
    camera.updateMatrixWorld();
  }

  // the stage's view, extended over the rows the canvas adds above and below it.
  useLayoutEffect(() => {
    const { width, height } = layout.canvas;
    const { above, below } = layout.room;
    const lens = camera as PerspectiveCamera;

    lens.aspect = width / height;
    lens.setViewOffset(width, height, 0, -above, width, height + above + below);
  }, [layout, camera]);

  // a positive priority stops Fiber rendering on its own, so `gl.render()` draws each frame Fiber runs.
  useFrame((_, delta) => {
    const st = state.current;
    const p = scrub.current;
    let posed = reducedMotion ? Math.round(p) : p;

    if (st.revealed) {
      // a frame asked for before the loop stopped would show the hidden canvas again.
      if (latest.current.frameloop === "never") return;
      if (!reducedMotion) {
        // a hidden canvas shows nothing to move from, so the records start where the scroll is.
        const from = eased.current === null || gl.domElement.style.visibility === "hidden" ? p : eased.current;

        posed = eased.current = easeScrub(from, p, delta);
        // demand rendering waits for a request, and the records are still catching up.
        if (posed !== p) invalidate();
      }
      const queued = textureQueue.current.shift();

      if (queued !== undefined) buildTexture(queued);
      // demand rendering draws no frame of its own, so the rest of the queue asks for the next one.
      if (textureQueue.current.length) invalidate();
      worldPose(posed);
      gl.render(scene, camera);
      gl.domElement.style.visibility = "";

      return;
    }
    // programs are cached by whether a material has a map, so every face gets its map before the compile.
    const queued = textureQueue.current.shift();

    if (queued !== undefined) {
      buildTexture(queued);

      return;
    }
    if (!st.compileStarted) {
      st.compileStarted = true;
      worldPose(posed);
      gl.compileAsync(scene, camera).then(
        () => (st.compiled = true),
        (error: unknown) => {
          console.error(error);
          st.compiled = true;
        },
      );

      return;
    }
    if (!st.compiled) return;
    if (!st.warmed) {
      // one hidden render compiles the shadow pass, which only builds while casters draw.
      worldPose(posed);
      gl.render(scene, camera);
      st.warmed = true;

      return;
    }
    worldPose(posed);
    gl.render(scene, camera);
    gl.domElement.style.visibility = "";
    st.revealed = true;
    latest.current.onRevealed();
  }, 1);

  return (
    <>
      <hemisphereLight args={["#ffffff", "#8a877f", 1.7]} />
      <primitive object={sunTarget} position={layout.sun.target} />
      <directionalLight
        intensity={2.2}
        position={layout.sun.position}
        target={sunTarget}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={layout.sun.left}
        shadow-camera-right={layout.sun.right}
        shadow-camera-top={layout.sun.top}
        shadow-camera-bottom={layout.sun.bottom}
        shadow-camera-near={layout.sun.near}
        shadow-camera-far={layout.sun.far}
        onUpdate={(l) => l.shadow.camera.updateProjectionMatrix()}
      />
      {layout.boxes.map((b, i) => (
        <mesh key={i} geometry={unitBox} position={b.center} scale={b.size} castShadow receiveShadow>
          <meshStandardMaterial color="#a9a69f" roughness={0.95} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={layout.ground.center} receiveShadow>
        <planeGeometry args={layout.ground.size} />
        <shadowMaterial transparent opacity={0.32} />
      </mesh>
      {snapshot.map((_, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)}>
          <mesh
            ref={(m) => void (faces.current[i] = m)}
            geometry={unitPlane}
            scale={[layout.W, layout.H, 1]}
            position={[0, layout.H / 2, 0]}
          >
            <meshBasicMaterial toneMapped={false} />
          </mesh>
          <mesh
            geometry={unitBox}
            scale={[layout.W, layout.H, BODY_DEPTH]}
            position={[0, layout.H / 2, -BODY_GAP - BODY_DEPTH / 2]}
            castShadow
          >
            <meshStandardMaterial color="#000000" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </>
  );
}
