import { createFileRoute } from "@tanstack/react-router";
import { AgentLobby } from "@/pages/AgentLobby";

export const Route = createFileRoute("/agent-lobby")({
  component: AgentLobby,
});
