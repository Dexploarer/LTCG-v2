import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@/router/react-router";

function RootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/agent-lobby", { replace: true });
  }, [navigate]);

  return null;
}

export const Route = createFileRoute("/")({
  component: RootRedirect,
});
