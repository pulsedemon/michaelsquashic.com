import { useRef, useState, type CSSProperties } from "react";
import { intro, projects, srcSet, type Project, type Screenshot } from "./content";
import { must } from "./must";
import { ProjectLink } from "./ProjectLink";

export function CaseStudy({ project }: { project: Project }) {
  const i = projects.indexOf(project);
  const previous = i > 0 ? projects[i - 1] : undefined;
  const next = projects.at(i + 1);

  return (
    <main className="page case-study">
      <nav className="case-study-nav" aria-label="Site">
        <a className="wordmark" href="/">
          {intro.name}
        </a>
        <a className="strong-link" href="/#work">
          All work
        </a>
      </nav>
      <h1>{project.title}</h1>
      <p className="stack">
        {project.role}, {project.years}. {project.stack.join(", ")}.
      </p>
      {(project.href ?? project.source) && (
        <div className="case-study-links">
          {project.href && <ProjectLink href={project.href} />}
          {project.source && (
            <a className="strong-link" href={project.source} target="_blank" rel="noreferrer">
              Read the source
            </a>
          )}
        </div>
      )}
      {project.images && <Gallery images={project.images} />}
      {project.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ))}
      <nav className="case-study-steps" aria-label="More work">
        {previous && (
          <a className="button" href={`/work/${previous.id}`}>
            Previous: {previous.title}
          </a>
        )}
        {next && (
          <a className="button case-study-next" href={`/work/${next.id}`}>
            Next: {next.title}
          </a>
        )}
      </nav>
    </main>
  );
}

const shotSizes = "min(1200px, 100vw)";

/** up to two pictures show full size; more show one at a time above thumbnails that pick it. */
function Gallery({ images }: { images: NonNullable<Project["images"]> }) {
  const [shown, setShown] = useState(0);

  if (images.length < 3) {
    return images.map((image) => <Shot key={image.src} image={image} />);
  }

  return (
    <>
      <Shot key={images[shown].src} image={images[shown]} />
      <div className="gallery">
        {images.map((image, i) => (
          <button
            key={image.src}
            className="gallery-thumb"
            aria-label={`Picture ${i + 1} of ${images.length}: ${image.alt}`}
            aria-current={i === shown}
            onClick={() => setShown(i)}
          >
            {/* a closed shot's sizes, so each thumbnail loads the file its shot shows. */}
            <img
              src={image.src}
              srcSet={srcSet(image)}
              sizes={shotSizes}
              width={image.width}
              height={image.height}
              alt=""
            />
          </button>
        ))}
      </div>
    </>
  );
}

/** how tall a phone opens a picture, in `svh`. */
const OPEN_SVH = 78;

/** a phone's picture is too small to read, so a tap opens it most of the screen tall, panned sideways to where it was tapped. */
function Shot({ image }: { image: Screenshot }) {
  const frame = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function flip(at = 0.5) {
    setOpen(!open);
    if (open) return;
    requestAnimationFrame(() => {
      const f = must(frame.current);

      f.scrollLeft = at * f.scrollWidth - f.clientWidth / 2;
    });
  }

  return (
    <figure className="shot-figure">
      <div
        className="shot-frame"
        ref={frame}
        data-open={open || undefined}
        style={{ "--open-height": `${OPEN_SVH}svh` } as CSSProperties}
      >
        <img
          className="shot"
          src={image.src}
          srcSet={srcSet(image)}
          // open, it is as wide as its height allows, on a phone only.
          sizes={
            open
              ? `(max-width: 760px) ${Math.round((OPEN_SVH * image.width) / image.height)}svh, ${shotSizes}`
              : shotSizes
          }
          width={image.width}
          height={image.height}
          alt={image.alt}
          onClick={(e) => {
            // the toggle shows only where pictures open, which the stylesheet decides.
            if (getComputedStyle(must(toggle.current)).display === "none") return;
            const r = e.currentTarget.getBoundingClientRect();

            flip(open ? undefined : (e.clientX - r.left) / r.width);
          }}
        />
      </div>
      <button ref={toggle} className="shot-toggle strong-link" aria-expanded={open} onClick={() => flip()}>
        {open ? "Shrink" : "Enlarge"}
      </button>
    </figure>
  );
}
