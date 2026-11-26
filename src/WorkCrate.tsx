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
import { swipeScrub, swipeSettle } from "./swipe";

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
    const pictures = [...must(grid.current).querySelectorAll("img")];

    /** the crate for the stage, from the grid's tracks and the bar, below the records or down their right side. */
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
      // the stylesheet stands the bar down the right side on a phone held sideways; the records then reach the bar's bottom, above the URL bar.
      const side = b.left > origin.left + 1;

      return crateLayout(
        { width: s.clientWidth, height: s.clientHeight },
        { column, row },
        side
          ? { floor: b.bottom - origin.top, topInset, sideLeft: b.left - origin.left }
          : { floor: b.top - origin.top, topInset },
        projects.length,
      );
    }
    const capture = () => {
      const [, { crateLayout }, , { captureCards }] = modules;

      setScene({ snapshot: captureCards(must(grid.current)), layout: measureLayout(crateLayout) });
    };
    // a resize can pick a wider file from a picture's srcset after its own capture drew the old one. loads landing in one frame share a capture.
    let recapture = 0;
    const onPictureLoad = () => {
      cancelAnimationFrame(recapture);
      recapture = requestAnimationFrame(capture);
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
          ...pictures.map((img) =>
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
      for (const img of pictures) img.addEventListener("load", onPictureLoad);
    };

    void load();

    return () => {
      cancelled = true;
      resized.disconnect();
      for (const img of pictures) img.removeEventListener("load", onPictureLoad);
      cancelAnimationFrame(recapture);
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

  // a sideways drag on the pinned stage scrubs the records under the finger, then settles on a whole one.
  // mounted once: a re-render as the drag passes half a record must not drop the drag.
  useEffect(() => {
    const s = must(stage.current);
    // the track is measured once per drag: it can't move under a finger, and measuring after each scroll forces a layout.
    let drag: {
      x: number;
      y: number;
      from: number;
      at: number;
      axis: "x" | "y" | null;
      track: ReturnType<typeof measureTrack>;
    } | null = null;

    const scrubTo = (p: number, smooth: boolean) => {
      const { top, step } = must(drag).track;

      scrollTo({ top: top + p * step, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
    };
    const onStart = (e: TouchEvent) => {
      const track = measureTrack();
      const raw = scrollY - track.top;

      // a second finger is a pinch: it ends the drag without stepping.
      if (e.touches.length > 1) drag = null;
      else if (!(e.target as Element).closest("a, button") && raw >= -1 && raw <= last * track.step + 1)
        drag = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          from: scrub.current,
          at: scrub.current,
          axis: null,
          track,
        };
    };
    const onMove = (e: TouchEvent) => {
      if (!drag) return;
      const dx = e.touches[0].clientX - drag.x;
      const dy = e.touches[0].clientY - drag.y;

      if (!drag.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        // a move the browser has already taken for its own scroll can't be cancelled, so it stays a scroll.
        drag.axis = Math.abs(dx) > Math.abs(dy) && e.cancelable ? "x" : "y";
      }
      if (drag.axis === "y") return;
      e.preventDefault();
      drag.at = swipeScrub(drag.from, dx, s.clientWidth, last);
      scrubTo(drag.at, false);
    };
    // settles from where the finger left the records: `scrub` follows the scroll a frame late.
    const onEnd = () => {
      if (drag?.axis === "x") scrubTo(swipeSettle(drag.from, drag.at, last), true);
      drag = null;
    };

    s.addEventListener("touchstart", onStart, { passive: true });
    s.addEventListener("touchmove", onMove, { passive: false });
    s.addEventListener("touchend", onEnd);
    s.addEventListener("touchcancel", onEnd);

    return () => {
      s.removeEventListener("touchstart", onStart);
      s.removeEventListener("touchmove", onMove);
      s.removeEventListener("touchend", onEnd);
      s.removeEventListener("touchcancel", onEnd);
    };
  }, []);

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
        <p className="crate-count" aria-hidden="true">
          {shown + 1}/{projects.length}
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
