import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/cockpit/dashboard";
export const Route = createFileRoute("/mileage")({
  head: () => ({
    meta: [
      { title: "Mileage Integrity | Autoscope" },
      {
        name: "description",
        content: "Compare manufacturer-specific ECU mileage readings and assess differences.",
      },
      { property: "og:title", content: "Mileage Integrity | Autoscope" },
      {
        property: "og:description",
        content: "Compare manufacturer-specific ECU mileage readings and assess differences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Dashboard view="mileage" />,
});
