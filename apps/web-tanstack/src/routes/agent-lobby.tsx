import { createFileRoute } from "@tanstack/react-router";
import { AgentLobby } from "@/pages/AgentLobby";
import { Protected } from "./__root";

function AgentLobbyRoute() {
  return (
    <Protected>
      <AgentLobby />
    </Protected>
  );
}

export const Route = createFileRoute("/agent-lobby")({
  component: AgentLobbyRoute,
});
