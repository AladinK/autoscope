import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/cockpit/dashboard";
export const Route = createFileRoute("/freeze-frame")({
  head: () => ({
    meta: [
      { title: "Freeze Frame | Autoscope" },
      {
        name: "description",
        content: "Inspect ECU sensor snapshots captured when a vehicle fault was recorded.",
      },
      { property: "og:title", content: "Freeze Frame | Autoscope" },
      {
        property: "og:description",
        content: "Inspect ECU sensor snapshots captured when a vehicle fault was recorded.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Dashboard view="freeze" />,
});
