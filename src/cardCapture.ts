import { must } from "./must";

/** one drawn character, in CSS pixels from its card's top left. */
type Glyph = { ch: string; x: number; baseline: number; font: string; color: string };
type Underline = { x: number; width: number; y: number; thickness: number; color: string };
/** a box in CSS pixels from its card's top left. */
export type Area = { x: number; y: number; width: number; height: number };
/** a picture as the page shows it, `object-fit: cover`, or a drawing whose polygons fill its box. */
type Picture = Area & ({ img: HTMLImageElement } | { svg: SVGSVGElement });
/** an element's background colour. */
type Fill = Area & { color: string };
export type CardShot = {
  rect: DOMRect;
  glyphs: Glyph[];
  underlines: Underline[];
  fills: Fill[];
  pictures: Picture[];
  title: Area & { link: HTMLAnchorElement };
  background: string;
};
/** the page cards as the browser laid them out. each rect grows to take in underlines drawn below its card. */
export type Snapshot = CardShot[];

const measure = must(document.createElement("canvas").getContext("2d"));

/** call after `document.fonts.ready` and the card images have decoded, so line breaks are Archivo's and pictures draw. */
export function captureCards(grid: HTMLElement): Snapshot {
  const background = getComputedStyle(document.documentElement).backgroundColor;

  return [...grid.querySelectorAll<HTMLElement>(".card")].map((card) => {
    const rect = card.getBoundingClientRect();
    const glyphs: Glyph[] = [];
    // underlined line spans per element, keyed by line top, so one link's text nodes share an underline the way the DOM draws it.
    const spans = new Map<Element, Map<number, Underline>>();
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    const range = document.createRange();

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = must(node.parentElement);
      const style = getComputedStyle(element);
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

      measure.font = font;
      const descent = measure.measureText("x").fontBoundingBoxDescent;
      let lines: Map<number, Underline> | null = null;

      if (style.textDecorationLine.includes("underline")) {
        lines = spans.get(element) ?? new Map();
        spans.set(element, lines);
      }
      const text = must(node.textContent);
      let overflows = false;

      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getClientRects().item(0);

        if (!r || !text[i].trim()) continue;
        // Chrome draws baselines on whole CSS pixels at any DPR.
        const baseline = Math.round(r.bottom - descent) - rect.top;

        glyphs.push({ ch: text[i], x: r.left - rect.left, baseline, font, color: style.color });
        if (import.meta.env.DEV) overflows ||= r.right > rect.right + 0.5 || r.left < rect.left - 0.5;
        if (!lines) continue;
        const line = lines.get(Math.round(r.top));

        if (line) line.width = r.right - rect.left - line.x;
        else
          lines.set(Math.round(r.top), {
            x: r.left - rect.left,
            width: r.width,
            y: baseline + (parseFloat(style.textUnderlineOffset) || 0),
            thickness: parseFloat(style.textDecorationThickness) || 1,
            color: style.color,
          });
      }
      if (overflows) console.error(`Card text overflows its card: "${text}"`);
    }
    const underlines = [...spans.values()].flatMap((lines) => [...lines.values()]);

    rect.height = Math.max(rect.height, ...underlines.map((u) => u.y + u.thickness));
    // Chrome paints a picture on whole CSS pixels, as it does baselines; drawn at its fractional rect, its edges land a row off.
    // a background is rounded the same way, so a block in a picture's place has a picture's edges.
    const area = (element: Element): Area => {
      const r = element.getBoundingClientRect();
      const left = Math.round(r.left);
      const top = Math.round(r.top);

      return {
        x: left - rect.left,
        y: top - rect.top,
        width: Math.round(r.right) - left,
        height: Math.round(r.bottom) - top,
      };
    };
    const fills = [...card.querySelectorAll("*")].flatMap((element) => {
      const color = getComputedStyle(element).backgroundColor;

      return color === "rgba(0, 0, 0, 0)" ? [] : [{ ...area(element), color }];
    });
    const pictures: Picture[] = [
      // an image that failed to load has nothing to draw, and drawing it would throw.
      ...[...card.querySelectorAll("img")].filter((img) => img.naturalWidth > 0).map((img) => ({ ...area(img), img })),
      ...[...card.querySelectorAll("svg")].map((svg) => ({ ...area(svg), svg })),
    ];
    const link = must(card.querySelector<HTMLAnchorElement>("h3 a"));
    const t = link.getBoundingClientRect();
    const title = { link, x: t.left - rect.left, y: t.top - rect.top, width: t.width, height: t.height };

    return { rect, glyphs, underlines, fills, pictures, title, background };
  });
}
