import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@/router/react-router";

function AgentDevRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/agent-lobby", { replace: true });
  }, [navigate]);

  return null;
}

export const Route = createFileRoute("/agent-dev")({
  component: AgentDevRedirect,
});
