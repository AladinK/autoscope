import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/cockpit/dashboard";
export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Diagnostic Reports | Autoscope" },
      {
        name: "description",
        content: "Download clearly sourced vehicle diagnostic reports as PDF or JSON.",
      },
      { property: "og:title", content: "Diagnostic Reports | Autoscope" },
      {
        property: "og:description",
        content: "Download clearly sourced vehicle diagnostic reports as PDF or JSON.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Dashboard view="reports" />,
});
