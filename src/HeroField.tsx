import { useEffect, useRef } from "react";
import { must } from "./must";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const columns = 10;
/** how long the pointer can rest before the bars go back to rippling. */
const idleMs = 3000;

type Bar = { x: number; y: number; column: number; row: number; angle: number };

const ripple = (bar: Bar, now: number) => Math.sin(now / 550 + bar.column * 0.5 + bar.row * 0.3) * (Math.PI / 3);

/** bars filling the hero's empty side: they point at the pointer, and ripple once it rests or leaves the window. */
export function HeroField() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = must(canvas.current);
    const ctx = must(c.getContext("2d"));
    let bars: Bar[] = [];
    let length = 0;
    let thickness = 0;
    let pointer: { x: number; y: number; at: number } | null = null;
    let frame = 0;
    let last = 0;

    function layout() {
      const dpr = devicePixelRatio;

      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = getComputedStyle(c).color;
      const spacing = c.clientWidth / columns;
      const rows = Math.floor(c.clientHeight / spacing);
      const top = (c.clientHeight - rows * spacing) / 2;

      length = spacing * 0.55;
      thickness = spacing * 0.12;
      const now = performance.now();

      bars = [];
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const bar = { x: (column + 0.5) * spacing, y: top + (row + 0.5) * spacing, column, row, angle: 0 };

          bar.angle = ripple(bar, now);
          bars.push(bar);
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
      for (const bar of bars) {
        ctx.save();
        ctx.translate(bar.x, bar.y);
        ctx.rotate(bar.angle);
        ctx.fillRect(-length / 2, -thickness / 2, length, thickness);
        ctx.restore();
      }
    }

    function tick(now: number) {
      const ease = last ? 1 - Math.exp(-(now - last) / 80) : 1;

      last = now;
      const rect = c.getBoundingClientRect();
      const target = pointer && now - pointer.at < idleMs ? pointer : null;

      for (const bar of bars) {
        const aim = target ? Math.atan2(target.y - rect.top - bar.y, target.x - rect.left - bar.x) : ripple(bar, now);
        // a bar looks the same turned half a turn, so it never swings further than a quarter turn.
        const turn = aim - bar.angle;

        bar.angle += (turn - Math.PI * Math.round(turn / Math.PI)) * ease;
      }
      draw();
      frame = requestAnimationFrame(tick);
    }

    const resize = new ResizeObserver(() => {
      layout();
      draw();
    });

    resize.observe(c);
    if (reducedMotion) return () => resize.disconnect();

    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY, at: performance.now() };
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) pointer = null;
    };
    // off screen, and while the narrow layout hides it, the field doesn't animate.
    const visible = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      last = 0;
      if (entry.isIntersecting) frame = requestAnimationFrame(tick);
    });

    visible.observe(c);
    addEventListener("pointermove", onMove);
    addEventListener("pointerout", onOut);

    return () => {
      resize.disconnect();
      visible.disconnect();
      cancelAnimationFrame(frame);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerout", onOut);
    };
  }, []);

  return <canvas className="hero-field" ref={canvas} aria-hidden="true" />;
}
