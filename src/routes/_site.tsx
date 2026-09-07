import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/es/site-shell";

export const Route = createFileRoute("/_site")({
  component: SiteShell,
});
