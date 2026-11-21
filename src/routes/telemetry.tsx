import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/cockpit/dashboard";
export const Route = createFileRoute("/telemetry")({
  head: () => ({
    meta: [
      { title: "Live Telemetry | Autoscope" },
      {
        name: "description",
        content: "Monitor live OBD-II sensor values and interactive vehicle telemetry charts.",
      },
      { property: "og:title", content: "Live Telemetry | Autoscope" },
      {
        property: "og:description",
        content: "Monitor live OBD-II sensor values and interactive vehicle telemetry charts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Dashboard view="telemetry" />,
});
