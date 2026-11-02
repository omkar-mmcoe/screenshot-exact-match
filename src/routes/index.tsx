import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import App from "../App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Cadence — University Timetable Management",
      },
      {
        name: "description",
        content:
          "Constraint-based academic timetabling: generate, validate, publish and export institution schedules with master, faculty and class views.",
      },
      {
        property: "og:title",
        content: "Cadence — University Timetable Management",
      },
      {
        property: "og:description",
        content:
          "Constraint-based academic timetabling: generate, validate, publish and export institution schedules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// The Cadence app holds randomized solver-seed state at mount, so it renders
// client-side only: the server (and the first client render) show a spinner,
// then App mounts — no hydration mismatch.
function Index() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          aria-label="Loading Cadence"
          role="status"
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-primary"
        />
      </div>
    );
  }

  return <App />;
}
