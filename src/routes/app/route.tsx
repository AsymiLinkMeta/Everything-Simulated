import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/es/app-shell";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/app")({
  head: () =>
    pageHead({
      title: "Customer app | Everything Simulated",
      description: "Quotes, builds and messages for Everything Simulated customers.",
      path: "/app",
      index: false,
    }),
  component: AppShell,
});
