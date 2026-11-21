import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/cockpit/dashboard";
export const Route = createFileRoute("/diagnostics")({
  head: () => ({
    meta: [
      { title: "Fault Diagnostics | Autoscope" },
      {
        name: "description",
        content: "Read stored, pending, and permanent vehicle diagnostic trouble codes.",
      },
      { property: "og:title", content: "Fault Diagnostics | Autoscope" },
      {
        property: "og:description",
        content: "Read stored, pending, and permanent vehicle diagnostic trouble codes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Dashboard view="diagnostics" />,
});
