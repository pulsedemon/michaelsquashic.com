import { useLayoutEffect, useState } from "react";
import { Page } from "./Page";

export function App() {
  const [webgl] = useState(() => document.createElement("canvas").getContext("webgl2") !== null);

  // the browser looks for the hash's target before React renders it; back and forward keep the restored position instead.
  useLayoutEffect(() => {
    const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];

    if (nav.type !== "back_forward") document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, []);

  return <Page webgl={webgl} />;
}
