import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { Snapshot } from "./cardCapture";
import { projects } from "./content";
import type { Layout } from "./crate";
import { must } from "./must";
import { ProjectLink } from "./ProjectLink";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const last = projects.length - 1;

/** the scene's code, loaded apart from the page so case studies and the page's first render don't wait on three.js. */
const loadScene = () =>
  Promise.all([import("./CrateCanvas"), import("./crate"), import("@react-three/fiber"), import("./cardCapture")]);

type SceneModules = Awaited<ReturnType<typeof loadScene>>;

/** a scroll sample: the scrub position, and whether the raw scroll lay inside the pinned range. */
type Sample = { p: number; pinned: boolean };

/** the Work section as a scroll track: its stage pins the crate full screen while the scroll flips through the records. */
export function WorkCrate({ grid }: { grid: RefObject<HTMLDivElement | null> }) {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const previous = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const caseStudy = useRef<HTMLAnchorElement>(null);
  const scrub = useRef(0);
  /** the Previous or Next step under way, the only thing the live region announces. */
  const pendingStep = useRef<{ from: number; to: number } | null>(null);
  /** whether any of the scene can be on screen, counting what it draws past the stage. */
  const [active, setActive] = useState(true);
  const [loaded, setLoaded] = useState<SceneModules | null>(null);
  const [scene, setScene] = useState<{ snapshot: Snapshot; layout: Layout } | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [shown, setShown] = useState(0);
  const [announced, setAnnounced] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  /** the track's top in the document and the scroll per record, which the stylesheet's `--step` owns. */
  function measureTrack() {
    const t = must(track.current).getBoundingClientRect();

    return { top: t.top + scrollY, step: (t.height - must(stage.current).getBoundingClientRect().height) / last };
  }

  /** samples the scroll into the scrub position and whether the scene is in view, and docks the Work title. */
  function sample(): Sample {
    const { top, step } = measureTrack();
    const raw = scrollY - top;

    dockTitle(-raw);
    const p = Math.min(last, Math.max(0, raw / step));

    if (scene) {
      // the canvas scrolls with the page, so only a new scrub position needs a frame.
      if (p !== scrub.current) must(loaded)[2].invalidate();
      const s = must(stage.current).getBoundingClientRect();

      setActive(s.top < innerHeight + scene.layout.room.above && s.bottom > -scene.layout.room.below);
    }
    scrub.current = p;
    const k = Math.round(p);
    const focused = document.activeElement;

    // move focus before the control disappears; the case-study link survives every record change.
    if (
      (k === 0 && focused === previous.current) ||
      (k === last && focused === next.current) ||
      (!projects[k].href && focused === must(bar.current).querySelector(".hud-visit a"))
    ) {
      const link = must(caseStudy.current);
      const bounds = link.getBoundingClientRect();

      if (bounds.top < innerHeight && bounds.bottom > 0) link.focus({ preventScroll: true });
    }

    setShown(k);
    // a step cut short by a scroll to some other record announces nothing when a later scroll reaches its target.
    const pending = pendingStep.current;

    if (pending && k !== pending.from && k !== pending.to) pendingStep.current = null;
    if (pendingStep.current?.to === k) {
      pendingStep.current = null;
      setAnnounced(k);
    } else setAnnounced((a) => (a === k ? a : null));

    return { p, pinned: raw >= 0 && raw <= last * step };
  }

  /**
   * shrinks the section's heading into the stage's corner between the heading sticking and the track pinning, then hands it to the stage's twin.
   * the section comes from the track: a ref on it attaches only after this component's mount layout effect has sampled.
   */
  function dockTitle(trackTop: number) {
    const section = must(must(track.current).parentElement);
    const heading = must(section.querySelector("h2"));
    const style = getComputedStyle(heading);
    // the heading's top margin collapses through the section, so the section's top is the heading's unstuck top.
    const range = trackTop - section.getBoundingClientRect().top + parseFloat(style.top);
    // within a pixel of pinned counts: scrolling to the track's fractional top can stop a fraction short.
    const docked = trackTop < 1;
    const progress = Math.min(1, Math.max(0, 1 - trackTop / range));

    heading.style.setProperty("--dock", String(reducedMotion ? Number(docked) : progress));
    section.style.setProperty(
      "--dock-scale",
      String(must(previous.current).getBoundingClientRect().height / parseFloat(style.height)),
    );
    section.toggleAttribute("data-docked", docked);
  }

  const onSample = useEffectEvent(sample);

  function stepBy(direction: 1 | -1) {
    const i = Math.round(scrub.current) + direction;

    if (i < 0 || i > last) return;
    pendingStep.current = { from: i - direction, to: i };
    // the button that reaches an end hides, so focus moves to the one that stays.
    if (i === 0 || i === last) must((direction === 1 ? previous : next).current).focus({ preventScroll: true });
    const { top, step } = measureTrack();

    scrollTo({ top: top + i * step, behavior: reducedMotion ? "auto" : "smooth" });
  }

  useEffect(() => {
    // held here because the ref is already null when the cleanup runs after unmount.
    const section = must(must(track.current).parentElement);
    let cancelled = false;
    let latest: Sample = { p: 0, pinned: false };
    let beforeResize: Sample | null = null;
    let size = { width: 0, height: 0 };
    // set once the scene's code loads, before the observer starts.
    let modules: SceneModules;

    /** the crate for the stage, from the grid's tracks and the bottom bar. */
    function measureLayout(crateLayout: SceneModules[1]["crateLayout"]): Layout {
      const style = getComputedStyle(must(grid.current));
      const column = parseFloat(style.gridTemplateColumns);
      const row = parseFloat(style.gridTemplateRows);

      if (import.meta.env.DEV) {
        const card = must(must(grid.current).querySelector<HTMLElement>(".card"));

        if (Math.abs(card.offsetHeight - row) > 1)
          console.error(`Grid row ${row}px doesn't match its card's ${card.offsetHeight}px`);
      }
      const s = must(stage.current);
      const origin = s.getBoundingClientRect();
      const b = must(bar.current).getBoundingClientRect();
      const padding = getComputedStyle(must(bar.current));
      // as much room above the records as a one-row bar takes below them, which also holds the docked Work title.
      const topInset =
        parseFloat(padding.paddingTop) +
        parseFloat(padding.paddingBottom) +
        must(previous.current).getBoundingClientRect().height;

      return crateLayout(
        { width: s.clientWidth, height: s.clientHeight },
        { column, row },
        { barTop: b.top - origin.top, topInset },
        projects.length,
      );
    }
    const capture = () => {
      const [, { crateLayout }, , { captureCards }] = modules;

      setScene({ snapshot: captureCards(must(grid.current)), layout: measureLayout(crateLayout) });
    };
    const resample = () => void (latest = onSample());
    // resize runs before the frame's scroll events, which may already come from the new layout.
    const onResize = () => (beforeResize = latest);
    const resized = new ResizeObserver(() => {
      const s = must(stage.current);

      if (s.clientWidth === size.width && s.clientHeight === size.height) return;
      size = { width: s.clientWidth, height: s.clientHeight };
      capture();
      // a stage resize without a window resize, from a scrollbar coming or going, has no earlier sample to restore.
      const before = beforeResize ?? latest;

      beforeResize = null;
      if (before.pinned) {
        const { top, step } = measureTrack();

        scrollTo({ top: top + before.p * step, behavior: "auto" });
      }
      // a scroll of under a pixel fires no scroll event.
      resample();
    });

    resample();
    addEventListener("scroll", resample, { passive: true });
    addEventListener("pageshow", resample);
    addEventListener("resize", onResize);
    const load = async () => {
      try {
        await Promise.all([
          loadScene().then((m) => {
            modules = m;
            // mounts the canvas now, so its context is created while the pictures load.
            if (!cancelled) setLoaded(m);
          }),
          document.fonts.ready,
          ...[...must(grid.current).querySelectorAll("img")].map((img) =>
            img.decode().catch((error: unknown) => console.error(`Couldn't decode ${img.src}`, error)),
          ),
        ]);
      } catch (error) {
        if (!cancelled) setLoadError(new Error("The crate couldn't load", { cause: error }));

        return;
      }
      if (cancelled) return;
      const s = must(stage.current);

      size = { width: s.clientWidth, height: s.clientHeight };
      capture();
      resized.observe(s);
    };

    void load();

    return () => {
      cancelled = true;
      resized.disconnect();
      removeEventListener("scroll", resample);
      removeEventListener("pageshow", resample);
      removeEventListener("resize", onResize);
      // the only docking state that outlives the crate, and it hides the section's heading.
      section.removeAttribute("data-docked");
    };
  }, [grid]);

  // the scene's room moves the track, so the scroll is sampled again once the margins are in.
  useLayoutEffect(() => void onSample(), [scene]);

  // each control's scroll margin reaches the stage's edges, so the browser's scroll to a focused control pins the stage.
  // left to itself, Chrome centres the control, which stops part-way into the track on the second record.
  useLayoutEffect(() => {
    const s = must(stage.current).getBoundingClientRect();

    for (const control of must(bar.current).querySelectorAll<HTMLElement>("a, button")) {
      const c = control.getBoundingClientRect();

      control.style.scrollMarginTop = `${c.top - s.top}px`;
      control.style.scrollMarginBottom = `${s.bottom - c.bottom}px`;
    }
  });

  // thrown here, where the crate's error boundary sees it and falls back to the cards.
  if (loadError) throw loadError;

  const project = projects[shown];
  const CrateCanvas = loaded?.[0].CrateCanvas;

  return (
    <div
      className="crate"
      ref={track}
      style={
        {
          "--records": projects.length,
          marginTop: scene?.layout.room.above,
          marginBottom: scene?.layout.room.below,
        } as CSSProperties
      }
    >
      <div className="crate-stage" ref={stage}>
        <p className="crate-title" aria-hidden="true">
          Work.
        </p>
        {CrateCanvas && (
          <CrateCanvas
            scene={scene}
            reducedMotion={reducedMotion}
            scrub={scrub}
            frameloop={!scene ? "never" : !revealed ? "always" : active ? "demand" : "never"}
            stage={stage}
            onRevealed={() => setRevealed(true)}
          />
        )}
        <footer className="hud-bottom" ref={bar}>
          {/* Previous and Next hide rather than unmount at either end, so the bar never shifts. */}
          <button
            ref={previous}
            className="button"
            style={{ visibility: shown === 0 ? "hidden" : undefined }}
            onClick={() => stepBy(-1)}
          >
            Previous
          </button>
          <div className="hud-link">
            <a className="button button-solid" href={`/work/${project.id}`} ref={caseStudy}>
              Read the case study<span className="sr-only">: {project.title}</span>
            </a>
            {/* every Visit link's size, so the bar is as tall for every project and the crate is framed once. */}
            <span className="hud-visit">
              {projects.map(
                (p) =>
                  p.href &&
                  // Mobile Safari doesn't paint a link inserted over a hidden span with the same text, so the shown project has none.
                  p !== project && (
                    <span key={p.id} className="hud-visit-size" aria-hidden="true">
                      Visit {new URL(p.href).host}
                    </span>
                  ),
              )}
              {project.href && <ProjectLink href={project.href} />}
            </span>
          </div>
          <button
            ref={next}
            className="button"
            style={{ visibility: shown === last ? "hidden" : undefined }}
            onClick={() => stepBy(1)}
          >
            Next
          </button>
          {/* empty except after a Previous or Next step: a scroll past the crate isn't news. */}
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announced !== null &&
              `Project ${announced + 1} of ${projects.length}: ${projects[announced].title}. ${projects[announced].stack.join(", ")}`}
          </p>
        </footer>
      </div>
    </div>
  );
}
