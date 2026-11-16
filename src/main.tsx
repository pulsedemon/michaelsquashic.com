import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CaseStudy } from "./CaseStudy";
import { intro, projects } from "./content";
import { Footer } from "./Footer";
import { must } from "./must";
import "./styles.css";

const id = /^\/work\/([^/]+)\/?$/.exec(location.pathname)?.[1];
const project = projects.find((p) => p.id === id);

if (project) document.title = `${project.title}, ${intro.name}`;

// rendered before the load event, so a back or forward finds the page tall enough to restore its scroll position.
const root = createRoot(must(document.getElementById("root")));

flushSync(() =>
  root.render(
    <StrictMode>
      {project ? <CaseStudy project={project} /> : <App />}
      <Footer />
    </StrictMode>,
  ),
);
