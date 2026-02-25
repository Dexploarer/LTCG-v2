import { useCallback } from "react";
import { motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { useNavigate } from "@/router/react-router";
import { storeRedirect } from "@/hooks/auth/usePostLoginRedirect";
import { PRIVY_ENABLED } from "@/lib/auth/privyEnv";

type OverlayNavItem = {
  id: "home" | "story" | "pvp" | "lobby" | "watch";
  label: string;
  path: string;
  requiresAuth: boolean;
};

const OVERLAY_NAV_ITEMS: OverlayNavItem[] = [
  { id: "home", label: "Home", path: "/", requiresAuth: false },
  { id: "story", label: "Story", path: "/story", requiresAuth: true },
  { id: "pvp", label: "Agent PvP", path: "/pvp", requiresAuth: true },
  { id: "lobby", label: "Lobby", path: "/agent-lobby", requiresAuth: true },
  { id: "watch", label: "Watch", path: "/watch", requiresAuth: false },
];

export function AgentOverlayNav({
  active,
}: {
  active: OverlayNavItem["id"];
}) {
  const navigate = useNavigate();
  const { authenticated, login } = PRIVY_ENABLED
    ? usePrivy()
    : { authenticated: false, login: () => {} };

  const handleNavigate = useCallback(
    (item: OverlayNavItem) => {
      if (item.requiresAuth && !authenticated) {
        storeRedirect(item.path);
        login();
        return;
      }
      navigate(item.path);
    },
    [authenticated, login, navigate],
  );

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-40 px-2"
      style={{ bottom: "calc(0.9rem + var(--safe-area-bottom))" }}
    >
      <motion.nav
        className="paper-panel scanner-noise px-2 py-2 flex items-center gap-1.5 shadow-zine-lg"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        aria-label="Agent overlay navigation"
      >
        {OVERLAY_NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item)}
              className={`px-3 py-2 text-[10px] md:text-[11px] uppercase tracking-wider font-black border-2 transition-colors ${
                isActive
                  ? "bg-[#121212] text-[#ffcc00] border-[#121212]"
                  : "bg-white text-[#121212] border-[#121212] hover:bg-[#ffcc00]"
              }`}
              style={{ fontFamily: "Outfit, sans-serif" }}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </motion.nav>
    </div>
  );
}
