import { Component, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { intro, jobs, projects, srcSet, type Screenshot } from "./content";
import { HeroField } from "./HeroField";
import { ProjectLink } from "./ProjectLink";
import { WorkCrate } from "./WorkCrate";

const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const getReducedMotion = () => motionPreference.matches;

function subscribeToMotionPreference(listener: () => void) {
  motionPreference.addEventListener("change", listener);

  return () => motionPreference.removeEventListener("change", listener);
}

export function Page({ webgl }: { webgl: boolean }) {
  const reducedMotion = useSyncExternalStore(subscribeToMotionPreference, getReducedMotion);
  const grid = useRef<HTMLDivElement>(null);
  const [crate, setCrate] = useState(webgl);

  return (
    <main className="page">
      <p className="wordmark">{intro.name}</p>
      <div className="hero">
        <h1>Hello.</h1>
        <p className="lede">{intro.body}</p>
        <HeroField reducedMotion={reducedMotion} />
      </div>

      <section id="work">
        <h2>Work.</h2>
        {crate && (
          <CrateBoundary onError={() => setCrate(false)}>
            <WorkCrate grid={grid} reducedMotion={reducedMotion} />
          </CrateBoundary>
        )}
        <div className="projects" ref={grid} data-crate-source={crate ? "" : undefined}>
          {projects.map((p) => (
            <article key={p.id} className="card">
              {/* the title link already says what it shows; the case study carries the full description. */}
              {p.images?.[0] && <CardShot image={p.images[0]} crate={crate} />}
              {p.cycle && (
                <div className="card-cycle">
                  {/* one arrow, 152 by 132, turned to point clockwise through each gap between the steps. */}
                  <svg viewBox="0 0 1600 1000" aria-hidden="true">
                    <polygon points="724,238 796,238 796,189 876,255 796,321 796,272 724,272" />
                    <polygon points="1212,424 1212,496 1261,496 1195,576 1129,496 1178,496 1178,424" />
                    <polygon points="876,762 804,762 804,811 724,745 804,679 804,728 876,728" />
                    <polygon points="388,576 388,504 339,504 405,424 471,504 422,504 422,576" />
                  </svg>
                  <ol>
                    {p.cycle.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="card-label">
                <h3>
                  <a href={`/work/${p.id}`}>{p.title}</a>
                </h3>
                <p className="stack">{p.stack.join(", ")}</p>
                {p.href && <ProjectLink href={p.href} />}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="career">
        <h2>Career.</h2>
        <JobList />
      </section>
    </main>
  );
}

/** picks a file wide enough for the crate's drawing of a card's picture: the screen's width in one column, else the larger of its height and 56% of its width, up to its width. */
const cardSizes = "(max-width: 760px) 100vw, min(100vw, max(100vh, 56vw))";

/** a card's picture. in the crate, a phone draws only its `phoneCrop`, so it asks for a file wide enough for the crop. */
function CardShot({ image, crate }: { image: Screenshot; crate: boolean }) {
  const crop = crate ? image.phoneCrop : undefined;

  return (
    <img
      className="card-shot"
      src={image.src}
      srcSet={srcSet(image)}
      sizes={crop ? `(max-width: 760px) ${Math.round(100 / crop.width)}vw, ${cardSizes}` : cardSizes}
      alt=""
    />
  );
}

/** falls back to the cards when the crate throws, which is how Fiber reports a renderer it couldn't create. */
class CrateBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function JobList() {
  return (
    <ol className="jobs">
      {[...jobs].reverse().map((job) => (
        <li key={job.id}>
          <span className="jobs-year">{job.span.slice(0, 4)}</span>
          <span>
            <strong>{job.company}</strong>
            <br />
            {job.role}, {job.span}.{job.note && <> {job.note}</>}
          </span>
        </li>
      ))}
    </ol>
  );
}
