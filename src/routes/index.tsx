import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/cockpit/dashboard";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vehicle Overview | Autoscope" },
      {
        name: "description",
        content:
          "Your vehicle cockpit for BLE OBD-II diagnostics, live sensors, and mileage integrity comparisons.",
      },
      { property: "og:title", content: "Vehicle Overview | Autoscope" },
      {
        property: "og:description",
        content: "Inspect vehicle health, compare ECU mileage and monitor live sensor readings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Dashboard />,
});
