import { createFileRoute } from "@tanstack/react-router";
import { StaffShell } from "@/components/es/staff-shell";

export const Route = createFileRoute("/staff")({
  component: StaffShell,
});
