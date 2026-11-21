import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/cockpit/dashboard";
export const Route = createFileRoute("/readiness")({
  head: () => ({
    meta: [
      { title: "Readiness Monitors | Autoscope" },
      {
        name: "description",
        content: "Check emissions inspection readiness for supported vehicle monitors.",
      },
      { property: "og:title", content: "Readiness Monitors | Autoscope" },
      {
        property: "og:description",
        content: "Check emissions inspection readiness for supported vehicle monitors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Dashboard view="readiness" />,
});
