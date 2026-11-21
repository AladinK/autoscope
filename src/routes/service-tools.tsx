import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/cockpit/dashboard";
export const Route = createFileRoute("/service-tools")({
  head: () => ({
    meta: [
      { title: "Service Tools | Autoscope" },
      {
        name: "description",
        content: "Oil reset, DPF regeneration, parking brake and battery registration with safety checks.",
      },
      { property: "og:title", content: "Service Tools | Autoscope" },
      {
        property: "og:description",
        content: "Oil reset, DPF regeneration, parking brake and battery registration with safety checks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Dashboard view="service" />,
});
