import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/es/staff-shell";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/staff")({
  head: () =>
    pageHead({
      title: "Staff | Everything Simulated",
      description: "Workshop portal.",
      path: "/staff",
      index: false,
    }),
  component: StaffShell,
});
