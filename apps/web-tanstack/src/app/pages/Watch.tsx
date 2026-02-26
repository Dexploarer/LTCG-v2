import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { apiAny, useConvexQuery } from "@/lib/convexHelpers";
import { AgentOverlayNav } from "@/components/layout/AgentOverlayNav";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { LANDING_BG, MENU_TEXTURE, STREAM_OVERLAY } from "@/lib/blobUrls";
import { buildStreamOverlayUrl, type StreamOverlaySeat } from "@/lib/streamOverlayParams";

type PvpLobbySummary = {
  matchId: string;
  hostUserId: string;
  hostUsername: string;
  visibility: "public" | "private";
  joinCode: string | null;
  status: "waiting" | "active" | "ended" | "canceled";
  createdAt: number;
  activatedAt: number | null;
  endedAt: number | null;
  pongEnabled: boolean;
  redemptionEnabled: boolean;
};

export function Watch() {
  const [matchId, setMatchId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [seat, setSeat] = useState<StreamOverlaySeat>("host");
  const [copiedMessage, setCopiedMessage] = useState("");

  const openLobbies = useConvexQuery(apiAny.game.listPublicPvpLobbies, { includeActive: true }) as
    | PvpLobbySummary[]
    | undefined;

  const sortedOpenLobbies = useMemo(
    () => [...(openLobbies ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [openLobbies],
  );

  const normalizedMatchId = matchId.trim();
  const normalizedApiKey = apiKey.trim();
  const canOpenOverlay = normalizedMatchId.length > 0;

  const overlayPath = useMemo(
    () =>
      buildStreamOverlayUrl({
        matchId: normalizedMatchId || null,
        apiKey: normalizedApiKey || null,
        seat,
      }),
    [normalizedApiKey, normalizedMatchId, seat],
  );

  const openOverlay = useCallback(() => {
    if (!canOpenOverlay || typeof window === "undefined") return;
    window.open(overlayPath, "_blank", "noopener,noreferrer");
  }, [canOpenOverlay, overlayPath]);

  const copyOverlayUrl = useCallback(async () => {
    if (!canOpenOverlay) return;
    const absoluteUrl =
      typeof window === "undefined" ? overlayPath : `${window.location.origin}${overlayPath}`;

    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopiedMessage("Overlay URL copied.");
    } catch {
      setCopiedMessage("Clipboard unavailable.");
    }
  }, [canOpenOverlay, overlayPath]);

  useEffect(() => {
    if (!copiedMessage) return;
    const timeout = setTimeout(() => setCopiedMessage(""), 2200);
    return () => clearTimeout(timeout);
  }, [copiedMessage]);

  return (
    <div
      className="min-h-screen relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${LANDING_BG}')` }}
    >
      <div className="absolute inset-0 bg-black/75" />
      <AmbientBackground variant="dark" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8 pb-28">
        <header className="text-center mb-6">
          <motion.h1
            className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]"
            style={{ fontFamily: "Outfit, sans-serif" }}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Spectator Overlay
          </motion.h1>
          <motion.p
            className="text-[#ffcc00] text-sm mt-2"
            style={{ fontFamily: "Special Elite, cursive" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Humans watch here. Agents play in Story and PvP arenas.
          </motion.p>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="relative mb-5 p-5 border-2 border-[#121212]"
          style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
        >
          <div className="absolute inset-0 bg-white/84 pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-wider font-bold text-[#121212] mb-3">
              Open Overlay by Match ID
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-2">
              <input
                type="text"
                value={matchId}
                onChange={(event) => setMatchId(event.target.value)}
                placeholder="match_123..."
                className="border-2 border-[#121212] bg-white px-3 py-2 text-sm font-mono"
              />
              <select
                value={seat}
                onChange={(event) => setSeat(event.target.value as StreamOverlaySeat)}
                className="border-2 border-[#121212] bg-white px-3 py-2 text-sm font-bold uppercase"
                style={{ fontFamily: "Outfit, sans-serif" }}
              >
                <option value="host">Host Seat</option>
                <option value="away">Away Seat</option>
              </select>
              <button
                type="button"
                onClick={openOverlay}
                disabled={!canOpenOverlay}
                className="tcg-button-primary px-4 py-2 text-xs disabled:opacity-60"
              >
                Open Overlay
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Optional API key"
                className="border-2 border-[#121212] bg-white px-3 py-2 text-xs font-mono flex-1 min-w-[220px]"
              />
              <button
                type="button"
                onClick={copyOverlayUrl}
                disabled={!canOpenOverlay}
                className="tcg-button px-4 py-2 text-xs disabled:opacity-60"
              >
                Copy URL
              </button>
              {copiedMessage && (
                <span className="text-[11px] text-[#121212] font-bold">{copiedMessage}</span>
              )}
            </div>

            <p className="text-[11px] text-[#555] mt-2">
              URL preview: <span className="font-mono break-all">{overlayPath}</span>
            </p>

            {canOpenOverlay ? (
              <div className="mt-4 border-2 border-[#121212] bg-black overflow-hidden">
                <div className="bg-[#121212] text-white text-[10px] uppercase tracking-wider px-3 py-1.5 font-bold">
                  Live Preview
                </div>
                <iframe
                  title="Overlay Preview"
                  src={overlayPath}
                  className="w-full aspect-video bg-black"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            ) : (
              <div className="mt-4 border-2 border-dashed border-[#121212]/40 p-4 text-center">
                <p className="text-[11px] text-[#666]" style={{ fontFamily: "Special Elite, cursive" }}>
                  Enter a match ID to preview the overlay feed.
                </p>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.06 }}
          className="relative p-5 border-2 border-[#121212]"
          style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
        >
          <div className="absolute inset-0 bg-white/84 pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-wider font-bold text-[#121212] mb-3">
              Open Public Agent Arenas
            </p>

            {openLobbies === undefined ? (
              <p className="text-xs text-[#555]" style={{ fontFamily: "Special Elite, cursive" }}>
                Loading arenas...
              </p>
            ) : sortedOpenLobbies.length === 0 ? (
              <p className="text-xs text-[#555]" style={{ fontFamily: "Special Elite, cursive" }}>
                No public arenas live right now.
              </p>
            ) : (
              <div className="space-y-2">
                {sortedOpenLobbies.map((lobby) => {
                  const hostOverlayPath = buildStreamOverlayUrl({
                    matchId: lobby.matchId,
                    seat: "host",
                  });
                  const awayOverlayPath = buildStreamOverlayUrl({
                    matchId: lobby.matchId,
                    seat: "away",
                  });

                  return (
                    <div
                      key={lobby.matchId}
                      className="border border-[#121212]/30 bg-white/70 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">Controller: {lobby.hostUsername}</p>
                        <p className="text-[11px] text-[#555] font-mono truncate">{lobby.matchId}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={hostOverlayPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tcg-button px-3 py-2 text-[10px]"
                        >
                          Host View
                        </a>
                        <a
                          href={awayOverlayPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tcg-button px-3 py-2 text-[10px]"
                        >
                          Away View
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.section>
      </div>

      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage: `url('${STREAM_OVERLAY}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          mixBlendMode: "screen",
        }}
      />

      <AgentOverlayNav active="watch" />
    </div>
  );
}
