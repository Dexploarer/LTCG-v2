import { useState, useCallback } from "react";
import { useNavigate } from "@/router/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { LOGO, DECO_PILLS, DECO_SHIELD, MENU_TEXTURE } from "@/lib/blobUrls";

const textLinks: Array<{ label: string; path: string } | { label: string; href: string }> = [
  { label: "Agent Lobby", path: "/agent-lobby" },
  { label: "Watch", path: "/watch" },
  { label: "Leaderboard", path: "/leaderboard" },
  { label: "$LUNCH", path: "/token" },
  { label: "X / Twitter", href: "https://x.com/LunchTableTCG" },
  { label: "Discord", href: import.meta.env.VITE_DISCORD_URL || "#" },
];

/**
 * Shared bottom tray navigation.
 * Renders a floating logo button + slide-up off-canvas menu.
 * Use on every public page as the primary nav.
 *
 * @param invert - invert the logo color (true for dark backgrounds)
 */
export function TrayNav({ invert = true }: { invert?: boolean }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const goTo = useCallback(
    (path: string) => {
      setMenuOpen(false);
      navigate(path);
    },
    [navigate],
  );

  return (
    <>
      {/* Floating logo button */}
      <div className="fixed left-1/2 -translate-x-1/2 z-30" style={{ bottom: "calc(0.75rem + var(--safe-area-bottom))" }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="group transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none"
        >
          <span className="relative flex items-center justify-center">
            <span className="absolute -inset-2 rounded-full bg-[#ffcc00]/40 blur-sm animate-pulse" />
            <span className="relative grid place-items-center h-14 w-14 rounded-full border-2 border-[#121212] bg-[#ffcc00] shadow-[0_10px_20px_rgba(18,18,18,0.35)]">
              <img
                src={LOGO}
                alt="Menu"
                className={`h-10 w-10 drop-shadow-[2px_2px_0px_rgba(0,0,0,0.8)] ${invert ? "invert" : ""}`}
                draggable={false}
              />
            </span>
            <span
              className="pointer-events-none absolute right-[-8px] top-1/2 z-20 -translate-y-1/2 mr-2 px-3 py-1.5 rounded-md border-2 border-[#121212] bg-[#fff] text-[#121212] shadow-[2px_2px_0px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: "Permanent Marker, cursive", letterSpacing: "0.08em" }}
            >
              Open Menu
              <span className="absolute left-[-10px] top-1/2 -translate-y-1/2 h-0 w-0 border-y-4 border-y-transparent border-r-[10px] border-r-[#121212]" />
              <span className="absolute left-[-8px] top-1/2 -translate-y-1/2 h-0 w-0 border-y-3 border-y-transparent border-r-[8px] border-r-[#fff]" />
            </span>
          </span>
        </button>
      </div>

      {/* Backdrop + Off-canvas tray menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuOpen(false)}
            />

            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Torn paper top edge */}
              <div
                className="h-4 w-full"
                style={{
                  background: "transparent",
                  clipPath:
                    "polygon(0% 100%, 2% 40%, 5% 80%, 8% 30%, 11% 70%, 14% 20%, 17% 60%, 20% 35%, 23% 75%, 26% 25%, 29% 65%, 32% 40%, 35% 80%, 38% 30%, 41% 70%, 44% 20%, 47% 55%, 50% 35%, 53% 75%, 56% 25%, 59% 60%, 62% 40%, 65% 80%, 68% 30%, 71% 65%, 74% 20%, 77% 55%, 80% 35%, 83% 75%, 86% 25%, 89% 60%, 92% 40%, 95% 70%, 98% 30%, 100% 100%)",
                  backgroundImage: `url('${MENU_TEXTURE}')`,
                  backgroundSize: "100% 100%",
                }}
              />

              {/* Menu body */}
              <div
                className="relative px-6 pt-2"
                style={{
                  paddingBottom: "calc(2rem + var(--safe-area-bottom))",
                  backgroundImage: `url('${MENU_TEXTURE}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                }}
              >
                {/* Dim overlay for readability */}
                <div className="absolute inset-0 bg-black/30 pointer-events-none" />

                {/* Drag handle */}
                <div className="relative flex justify-center mb-3">
                  <div className="w-12 h-1 bg-white/40 rounded-full" />
                </div>

                {/* Image nav row */}
                <div className="relative flex items-end justify-center gap-4 md:gap-6 mb-4 px-2">
                  {[
                    { src: LOGO, alt: "Home", label: "Home", path: "/", delay: 0 },
                    { src: DECO_PILLS, alt: "$LUNCH", label: "$LUNCH", path: "/token", delay: 0.05 },
                    { src: DECO_SHIELD, alt: "Privacy & Legal", label: "Legal", path: "/privacy", delay: 0.1 },
                  ].map((item) => (
                    <motion.button
                      key={item.path}
                      onClick={() => { setMenuOpen(false); navigate(item.path); }}
                      className="tray-icon-btn relative group"
                      title={item.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: item.delay, type: "spring", stiffness: 300, damping: 20 }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <img
                        src={item.src}
                        alt={item.alt}
                        className="h-20 md:h-16 w-auto brightness-110 contrast-110 hover:brightness-125 transition-all drop-shadow-[0_2px_12px_rgba(255,255,255,0.5)]"
                        draggable={false}
                        loading="lazy"
                      />
                      <span className="tray-tooltip">{item.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Desktop: Legal sub-links */}
                <div className="relative hidden md:flex justify-center gap-4 mb-3">
                  {[
                    { label: "Privacy Policy", path: "/privacy" },
                    { label: "Terms of Service", path: "/terms" },
                    { label: "About", path: "/about" },
                  ].map((item) => (
                    <button
                      key={item.path}
                      onClick={() => { setMenuOpen(false); navigate(item.path); }}
                      className="text-[clamp(0.65rem,1.5vw,0.8rem)] text-white/70 hover:text-white transition-colors uppercase tracking-wider font-bold"
                      style={{ fontFamily: "Permanent Marker, cursive", textShadow: "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000" }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="relative w-16 h-px bg-white/20 mx-auto mb-3" />

                {/* Text links */}
                <div className="relative flex flex-wrap justify-center gap-x-5 gap-y-1 max-w-md mx-auto">
                  {textLinks.map((item, i) =>
                    "href" in item ? (
                      <motion.a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-[clamp(1rem,2.5vw,1.25rem)] font-bold uppercase tracking-wider text-white hover:text-[#ffcc00] transition-colors"
                        style={{ fontFamily: "Permanent Marker, cursive", textShadow: "2px 2px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000" }}
                        initial={{ opacity: 0, y: 10, rotate: -2 }}
                        animate={{ opacity: 1, y: 0, rotate: 0 }}
                        transition={{ delay: 0.15 + i * 0.03 }}
                      >
                        {item.label}
                      </motion.a>
                    ) : (
                      <motion.button
                        key={item.label}
                        onClick={() => goTo(item.path)}
                        className="px-2 py-1 text-[clamp(1rem,2.5vw,1.25rem)] font-bold uppercase tracking-wider text-white hover:text-[#ffcc00] transition-colors"
                        style={{ fontFamily: "Permanent Marker, cursive", textShadow: "2px 2px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000" }}
                        initial={{ opacity: 0, y: 10, rotate: -2 }}
                        animate={{ opacity: 1, y: 0, rotate: 0 }}
                        transition={{ delay: 0.15 + i * 0.03 }}
                      >
                        {item.label}
                      </motion.button>
                    ),
                  )}
                </div>

                {/* Close hint */}
                <p
                  className="relative text-center text-[clamp(0.6rem,1.2vw,0.75rem)] text-white/40 mt-3"
                  style={{ fontFamily: "Special Elite, cursive", textShadow: "1px 1px 0 #000" }}
                >
                  tap outside to close
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
