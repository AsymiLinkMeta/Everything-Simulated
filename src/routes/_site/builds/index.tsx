import { createFileRoute, Navigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/builds/")({
  head: () =>
    pageHead({
      title: "Sim racing prebuilds | Everything Simulated",
      description:
        "Gold Coast built racing simulators. Preconfigured crates, compatibility checked before deposit, delivered Australia-wide.",
      path: "/prebuilds",
    }),
  component: () => <Navigate to="/prebuilds" replace />,
});
