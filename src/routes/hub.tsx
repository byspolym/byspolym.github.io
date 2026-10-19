import { createFileRoute } from "@tanstack/react-router";
import { HubShell } from "@/components/layout/hub-shell";

export const Route = createFileRoute("/hub")({
  component: HubShell,
});
