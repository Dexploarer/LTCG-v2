import { useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@/router/react-router";

type OverlayNavItem = {
  id: "home" | "lobby" | "watch";
  label: string;
  path: string;
};

const OVERLAY_NAV_ITEMS: OverlayNavItem[] = [
  { id: "home", label: "Home", path: "/" },
  { id: "lobby", label: "Lobby", path: "/agent-lobby" },
  { id: "watch", label: "Watch", path: "/watch" },
];

export function AgentOverlayNav({
  active,
}: {
  active: OverlayNavItem["id"];
}) {
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (item: OverlayNavItem) => {
      navigate(item.path);
    },
    [navigate],
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
