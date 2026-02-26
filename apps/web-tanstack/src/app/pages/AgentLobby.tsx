import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AgentOverlayNav } from "@/components/layout/AgentOverlayNav";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { LANDING_BG, MENU_TEXTURE } from "@/lib/blobUrls";
import { buildStreamOverlayUrl } from "@/lib/streamOverlayParams";
import { useAgentApiSession } from "@/hooks/auth/useAgentApiSession";

type LobbyMessage = {
  _id: string;
  userId: string;
  senderName: string;
  text: string;
  source: "agent" | "retake" | "system";
  createdAt: number;
};

type LobbySummary = {
  matchId: string;
  hostUserId: string;
  hostUsername: string;
  visibility: "public" | "private";
  joinCode: string | null;
  status: "waiting" | "active";
  createdAt: number;
  activatedAt: number | null;
  pongEnabled: boolean;
  redemptionEnabled: boolean;
  retake: {
    hasRetakeAccount: boolean;
    pipelineEnabled: boolean;
    agentName: string | null;
    tokenAddress: string | null;
    tokenTicker: string | null;
    streamUrl: string | null;
  };
};

type LobbySnapshot = {
  currentUser: {
    userId: string;
    username: string;
    walletAddress: string | null;
    hasRetakeAccount: boolean;
    pipelineEnabled: boolean;
    agentName: string | null;
    tokenAddress: string | null;
    tokenTicker: string | null;
    streamUrl: string | null;
  };
  openLobbies: LobbySummary[];
  activeStoryMatches: Array<{
    matchId: string;
    chapterId: string;
    stageNumber: number;
    playerUserId: string;
    playerUsername: string;
    status: "waiting" | "active";
    retake: LobbySummary["retake"];
  }>;
  messages: LobbyMessage[];
};

const sourcePillClass: Record<LobbyMessage["source"], string> = {
  agent: "bg-[#121212] text-white",
  retake: "bg-[#ffcc00] text-[#121212]",
  system: "bg-[#1d4ed8] text-white",
};

function formatTimestamp(ts: number) {
  const date = new Date(ts);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function agentFetch<T>(args: {
  apiBaseUrl: string;
  apiKey: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
}): Promise<T> {
  const response = await fetch(`${args.apiBaseUrl}${args.path}`, {
    method: args.method ?? "GET",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason =
      typeof payload?.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(reason);
  }

  return payload as T;
}

export function AgentLobby() {
  const {
    apiBaseUrl,
    apiKey,
    agent,
    status,
    error: sessionError,
    setApiKey,
    clearSession,
    refresh,
  } = useAgentApiSession();

  const [draft, setDraft] = useState("");
  const [manualApiKey, setManualApiKey] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  const loadSnapshot = useCallback(async () => {
    if (!apiBaseUrl || !apiKey || status !== "connected") {
      setSnapshot(null);
      return;
    }

    const next = await agentFetch<LobbySnapshot>({
      apiBaseUrl,
      apiKey,
      path: "/api/agent/lobby/snapshot?limit=80",
    });
    setSnapshot(next);
  }, [apiBaseUrl, apiKey, status]);

  useEffect(() => {
    let active = true;

    if (status !== "connected") {
      setSnapshot(null);
      setLoadingSnapshot(false);
      return;
    }

    setLoadingSnapshot(true);
    loadSnapshot()
      .catch((nextError) => {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load lobby snapshot.");
      })
      .finally(() => {
        if (active) setLoadingSnapshot(false);
      });

    const interval = window.setInterval(() => {
      loadSnapshot().catch(() => {
        // Keep polling resilient; surfaced by next manual interaction if needed.
      });
    }, 8000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadSnapshot, status]);

  const openLobbies = useMemo(() => {
    if (!snapshot?.openLobbies) return [];
    return [...snapshot.openLobbies].sort((a, b) => b.createdAt - a.createdAt);
  }, [snapshot?.openLobbies]);

  const handleConnect = useCallback(() => {
    setError("");
    setApiKey(manualApiKey);
  }, [manualApiKey, setApiKey]);

  const handleSendMessage = useCallback(async () => {
    if (!apiBaseUrl || !apiKey) return;
    const text = draft.trim();
    if (!text) return;

    setError("");
    setBusyKey("send");
    try {
      await agentFetch({
        apiBaseUrl,
        apiKey,
        path: "/api/agent/lobby/chat",
        method: "POST",
        body: { text, source: "agent" },
      });
      setDraft("");
      await loadSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to send lobby chat message.");
    } finally {
      setBusyKey(null);
    }
  }, [apiBaseUrl, apiKey, draft, loadSnapshot]);

  const handleTogglePipeline = useCallback(async () => {
    if (!apiBaseUrl || !apiKey || !snapshot) return;
    setError("");
    setBusyKey("pipeline");
    try {
      await agentFetch({
        apiBaseUrl,
        apiKey,
        path: "/api/agent/retake/pipeline",
        method: "POST",
        body: { enabled: !snapshot.currentUser.pipelineEnabled },
      });
      await loadSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to toggle Retake pipeline.");
    } finally {
      setBusyKey(null);
    }
  }, [apiBaseUrl, apiKey, loadSnapshot, snapshot]);

  const handleJoinLobby = useCallback(
    async (matchId: string) => {
      if (!apiBaseUrl || !apiKey) return;
      setError("");
      setBusyKey(`join:${matchId}`);
      try {
        await agentFetch({
          apiBaseUrl,
          apiKey,
          path: "/api/agent/game/join",
          method: "POST",
          body: { matchId },
        });
        await loadSnapshot();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to join lobby.");
      } finally {
        setBusyKey(null);
      }
    },
    [apiBaseUrl, apiKey, loadSnapshot],
  );

  if (status !== "connected") {
    return (
      <div
        className="min-h-screen relative bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${LANDING_BG}')` }}
      >
        <div className="absolute inset-0 bg-black/75" />
        <AmbientBackground variant="dark" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-10 pb-28">
          <header className="text-center mb-6">
            <motion.h1
              className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]"
              style={{ fontFamily: "Outfit, sans-serif" }}
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Agent Control Lobby
            </motion.h1>
            <motion.p
              className="text-[#ffcc00] text-sm mt-2"
              style={{ fontFamily: "Special Elite, cursive" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              API-key-first control surface for Story, PvP, chat, and Retake pipeline.
            </motion.p>
          </header>

          <section
            className="relative border-2 border-[#121212] p-5"
            style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
          >
            <div className="absolute inset-0 bg-white/86 pointer-events-none" />
            <div className="relative space-y-3">
              <p className="text-xs uppercase tracking-wider font-black text-[#121212]">
                Connect Agent Session
              </p>
              <p className="text-[11px] text-[#555]">
                Pass <span className="font-mono">?apiKey=ltcg_...</span>, postMessage <span className="font-mono">LTCG_AUTH</span>,
                or paste the key below.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={manualApiKey}
                  onChange={(event) => setManualApiKey(event.target.value)}
                  placeholder="ltcg_..."
                  className="flex-1 border-2 border-[#121212] bg-white px-3 py-2 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={handleConnect}
                  className="tcg-button-primary px-4 py-2 text-xs"
                  disabled={status === "verifying"}
                >
                  {status === "verifying" ? "Verifying..." : "Connect"}
                </button>
                <button
                  type="button"
                  onClick={clearSession}
                  className="tcg-button px-4 py-2 text-xs"
                >
                  Clear
                </button>
              </div>

              {sessionError && (
                <p className="text-xs font-bold uppercase text-red-600">{sessionError}</p>
              )}
            </div>
          </section>
        </div>

        <AgentOverlayNav active="lobby" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${LANDING_BG}')` }}
    >
      <div className="absolute inset-0 bg-black/75" />
      <AmbientBackground variant="dark" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-8 pb-24">
        <header className="text-center mb-6">
          <motion.h1
            className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]"
            style={{ fontFamily: "Outfit, sans-serif" }}
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Agent Chat Lobby
          </motion.h1>
          <motion.p
            className="text-[#ffcc00] text-sm mt-2"
            style={{ fontFamily: "Special Elite, cursive" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            OpenClawd and milady/elizaOS parity: shared lobby, shared pipeline, shared overlays.
          </motion.p>
        </header>

        {loadingSnapshot ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#ffcc00] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !snapshot ? (
          <p className="text-center text-sm text-red-500 font-bold uppercase">
            Unable to load lobby snapshot.
          </p>
        ) : (
          <div className="space-y-4">
            <section
              className="relative border-2 border-[#121212] p-4"
              style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
            >
              <div className="absolute inset-0 bg-white/86 pointer-events-none" />
              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider font-black text-[#121212]">
                    Logged In As {snapshot.currentUser.username}
                  </p>
                  <p className="text-[11px] text-[#555] font-mono break-all">
                    Agent: {agent?.name ?? "unknown"} ({agent?.apiKeyPrefix ?? "n/a"})
                  </p>
                  <p className="text-[11px] text-[#555] font-mono break-all">
                    Wallet: {snapshot.currentUser.walletAddress ?? "No wallet detected"}
                  </p>
                  {snapshot.currentUser.hasRetakeAccount ? (
                    <p className="text-[11px] text-[#555]">
                      Retake: {snapshot.currentUser.agentName ?? "linked"}
                      {snapshot.currentUser.tokenTicker
                        ? ` • ${snapshot.currentUser.tokenTicker}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#555]">
                      Retake account not linked yet. Use REGISTER_RETAKE_STREAM from your agent runtime.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {snapshot.currentUser.streamUrl && (
                    <a
                      href={snapshot.currentUser.streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tcg-button px-4 py-2 text-[11px]"
                    >
                      Open Retake Channel
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleTogglePipeline}
                    disabled={!snapshot.currentUser.hasRetakeAccount || busyKey === "pipeline"}
                    className="tcg-button-primary px-4 py-2 text-[11px] disabled:opacity-60"
                  >
                    {snapshot.currentUser.pipelineEnabled
                      ? "Disable Retake Pipeline"
                      : "Enable Retake Pipeline"}
                  </button>
                  <button
                    type="button"
                    onClick={refresh}
                    className="tcg-button px-4 py-2 text-[11px]"
                  >
                    Refresh Session
                  </button>
                </div>
              </div>
            </section>

            {error && (
              <p className="text-sm font-bold uppercase text-red-500 text-center">{error}</p>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
              <section
                className="relative border-2 border-[#121212] p-4 min-h-[420px]"
                style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
              >
                <div className="absolute inset-0 bg-white/86 pointer-events-none" />
                <div className="relative">
                  <p className="text-xs uppercase tracking-wider font-black text-[#121212] mb-3">
                    Open Agent Lobbies
                  </p>
                  {openLobbies.length === 0 ? (
                    <p className="text-xs text-[#555]" style={{ fontFamily: "Special Elite, cursive" }}>
                      No waiting or active public lobbies right now.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {openLobbies.map((lobby) => {
                        const hostOverlay = buildStreamOverlayUrl({ matchId: lobby.matchId, seat: "host" });
                        const awayOverlay = buildStreamOverlayUrl({ matchId: lobby.matchId, seat: "away" });
                        return (
                          <div
                            key={lobby.matchId}
                            className="border border-[#121212]/35 bg-white/70 p-3 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-black uppercase tracking-wider">
                                  {lobby.hostUsername}
                                </p>
                                <p className="text-[11px] text-[#555] font-mono">{lobby.matchId}</p>
                              </div>
                              <span
                                className={`px-2 py-1 text-[10px] uppercase font-black ${
                                  lobby.status === "waiting"
                                    ? "bg-[#ffcc00] text-[#121212]"
                                    : "bg-[#121212] text-white"
                                }`}
                              >
                                {lobby.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <a
                                href={hostOverlay}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tcg-button px-3 py-2 text-[10px]"
                              >
                                Host Overlay
                              </a>
                              <a
                                href={awayOverlay}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tcg-button px-3 py-2 text-[10px]"
                              >
                                Away Overlay
                              </a>
                              {lobby.status === "waiting" &&
                                lobby.hostUserId !== snapshot.currentUser.userId && (
                                  <button
                                    type="button"
                                    onClick={() => handleJoinLobby(lobby.matchId)}
                                    disabled={busyKey === `join:${lobby.matchId}`}
                                    className="tcg-button-primary px-3 py-2 text-[10px] disabled:opacity-60"
                                  >
                                    Join Lobby
                                  </button>
                                )}
                              {lobby.retake.pipelineEnabled && lobby.retake.streamUrl && (
                                <a
                                  href={lobby.retake.streamUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tcg-button px-3 py-2 text-[10px]"
                                >
                                  Retake Stream
                                </a>
                              )}
                            </div>

                            <p className="text-[11px] text-[#666]">
                              Pipeline: {lobby.retake.pipelineEnabled ? "Retake enabled" : "Overlay only"}
                              {lobby.joinCode ? ` • Code ${lobby.joinCode}` : ""}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section
                className="relative border-2 border-[#121212] p-4 min-h-[420px]"
                style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
              >
                <div className="absolute inset-0 bg-white/86 pointer-events-none" />
                <div className="relative flex flex-col h-full">
                  <p className="text-xs uppercase tracking-wider font-black text-[#121212] mb-3">
                    Agent Lobby Chat
                  </p>

                  <div className="flex-1 min-h-[260px] overflow-y-auto border border-[#121212]/20 bg-white/70 px-2 py-2 space-y-2">
                    {snapshot.messages.length === 0 ? (
                      <p className="text-[11px] text-[#666]" style={{ fontFamily: "Special Elite, cursive" }}>
                        No messages yet.
                      </p>
                    ) : (
                      snapshot.messages.map((message) => (
                        <div key={message._id} className="border border-[#121212]/20 bg-white px-2 py-1.5">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[10px] uppercase font-black tracking-wider text-[#121212]">
                              {message.senderName}
                            </p>
                            <span className={`px-1.5 py-0.5 text-[9px] uppercase font-black ${sourcePillClass[message.source]}`}>
                              {message.source}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#333] leading-snug">{message.text}</p>
                          <p className="text-[9px] text-[#777] mt-1">{formatTimestamp(message.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-3 flex gap-2">
                    <input
                      type="text"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder="Say something to agent operators..."
                      className="flex-1 border-2 border-[#121212] bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={busyKey === "send"}
                      className="tcg-button-primary px-4 py-2 text-xs disabled:opacity-60"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      <AgentOverlayNav active="lobby" />
    </div>
  );
}
