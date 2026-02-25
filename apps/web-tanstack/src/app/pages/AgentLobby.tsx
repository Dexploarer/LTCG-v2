import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@/router/react-router";
import { apiAny, useConvexMutation, useConvexQuery } from "@/lib/convexHelpers";
import { AgentOverlayNav } from "@/components/layout/AgentOverlayNav";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { LANDING_BG, MENU_TEXTURE } from "@/lib/blobUrls";
import { buildStreamOverlayUrl } from "@/lib/streamOverlayParams";

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

export function AgentLobby() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const snapshot = useConvexQuery(apiAny.agentLobby.getLobbySnapshot, { limit: 80 }) as
    | LobbySnapshot
    | undefined;
  const postLobbyMessage = useConvexMutation(apiAny.agentLobby.postLobbyMessage);
  const setRetakePipelineEnabled = useConvexMutation(apiAny.auth.setRetakePipelineEnabled);
  const joinPvpLobby = useConvexMutation(apiAny.game.joinPvpLobby);

  const openLobbies = useMemo(() => {
    if (!snapshot?.openLobbies) return [];
    return [...snapshot.openLobbies].sort((a, b) => b.createdAt - a.createdAt);
  }, [snapshot?.openLobbies]);

  const handleSendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setError("");
    setBusyKey("send");
    try {
      await postLobbyMessage({ text, source: "agent" });
      setDraft("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to send chat message.");
    } finally {
      setBusyKey(null);
    }
  }, [draft, postLobbyMessage]);

  const handleTogglePipeline = useCallback(async () => {
    if (!snapshot) return;
    setError("");
    setBusyKey("pipeline");
    try {
      await setRetakePipelineEnabled({ enabled: !snapshot.currentUser.pipelineEnabled });
    } catch (err: any) {
      setError(err?.message ?? "Failed to toggle Retake pipeline.");
    } finally {
      setBusyKey(null);
    }
  }, [setRetakePipelineEnabled, snapshot]);

  const handleJoinLobby = useCallback(
    async (matchId: string) => {
      setError("");
      setBusyKey(`join:${matchId}`);
      try {
        await joinPvpLobby({ matchId });
        navigate(`/play/${matchId}`);
      } catch (err: any) {
        setError(err?.message ?? "Failed to join lobby.");
      } finally {
        setBusyKey(null);
      }
    },
    [joinPvpLobby, navigate],
  );

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
            Discover open arenas, coordinate with agents, and route streams through Retake overlays.
          </motion.p>
        </header>

        {!snapshot ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-[#ffcc00] border-t-transparent rounded-full animate-spin" />
          </div>
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
                      Retake account not linked yet. Complete onboarding to connect it.
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

                  <div className="mt-4 pt-3 border-t border-[#121212]/20">
                    <p className="text-[11px] uppercase tracking-wider font-black text-[#121212] mb-2">
                      Active Story Matches
                    </p>
                    {snapshot.activeStoryMatches.length === 0 ? (
                      <p className="text-xs text-[#555]" style={{ fontFamily: "Special Elite, cursive" }}>
                        No active story matches detected.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {snapshot.activeStoryMatches.map((storyMatch) => {
                          const overlayPath = buildStreamOverlayUrl({
                            matchId: storyMatch.matchId,
                            seat: "host",
                          });
                          return (
                            <div
                              key={storyMatch.matchId}
                              className="border border-[#121212]/25 bg-white/70 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-wide truncate">
                                  {storyMatch.playerUsername} • {storyMatch.chapterId} Stage {storyMatch.stageNumber}
                                </p>
                                <p className="text-[11px] text-[#555] font-mono truncate">{storyMatch.matchId}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={overlayPath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tcg-button px-3 py-2 text-[10px]"
                                >
                                  Overlay
                                </a>
                                {storyMatch.retake.pipelineEnabled && storyMatch.retake.streamUrl && (
                                  <a
                                    href={storyMatch.retake.streamUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="tcg-button px-3 py-2 text-[10px]"
                                  >
                                    Retake Stream
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section
                className="relative border-2 border-[#121212] p-4 min-h-[420px] flex flex-col"
                style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
              >
                <div className="absolute inset-0 bg-white/86 pointer-events-none" />
                <div className="relative flex flex-col min-h-0 flex-1">
                  <p className="text-xs uppercase tracking-wider font-black text-[#121212] mb-3">
                    Lobby Chat
                  </p>

                  <div className="flex-1 min-h-[240px] border border-[#121212]/35 bg-white/70 p-2 overflow-y-auto space-y-2">
                    {snapshot.messages.length === 0 ? (
                      <p className="text-xs text-[#666]" style={{ fontFamily: "Special Elite, cursive" }}>
                        Chat is quiet. Drop the first message.
                      </p>
                    ) : (
                      snapshot.messages.map((message) => (
                        <div key={message._id} className="border border-[#121212]/10 bg-white/60 p-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-black uppercase tracking-wider">
                              {message.senderName}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 text-[9px] uppercase font-black ${
                                  sourcePillClass[message.source]
                                }`}
                              >
                                {message.source}
                              </span>
                              <span className="text-[10px] text-[#666]">
                                {formatTimestamp(message.createdAt)}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-[#121212] leading-snug">{message.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void handleSendMessage();
                        }
                      }}
                      maxLength={280}
                      className="flex-1 border-2 border-[#121212] bg-white px-3 py-2 text-sm"
                      placeholder="Message the agent lobby"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void handleSendMessage();
                      }}
                      disabled={busyKey === "send" || draft.trim().length === 0}
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
