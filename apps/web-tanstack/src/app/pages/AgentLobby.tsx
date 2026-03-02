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

type StoryNextStageResponse = {
  done: boolean;
  chapterId?: string;
  stageNumber?: number;
};

type CreatedPvpLobby = {
  matchId: string;
  visibility: "public";
  joinCode: null;
  status: "waiting";
  createdAt: number;
};

type RegisteredAgentResponse = {
  id: string;
  userId: string;
  name: string;
  apiKey: string;
  apiKeyPrefix: string;
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
  apiKey?: string | null;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (args.apiKey) {
    headers.Authorization = `Bearer ${args.apiKey}`;
  }

  const response = await fetch(`${args.apiBaseUrl}${args.path}`, {
    method: args.method ?? "GET",
    headers,
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

function randomAgentName() {
  return `ltcg-agent-${Math.random().toString(36).slice(2, 8)}`;
}

function buildOpenClawdEnvSnippet(apiUrl: string, key: string) {
  return [
    `export LTCG_API_URL="${apiUrl}"`,
    `export LTCG_API_KEY="${key}"`,
    "export LTCG_RUNTIME=openclawd",
  ].join("\n");
}

function buildElizaEnvSnippet(apiUrl: string, key: string) {
  return [
    `export LTCG_API_URL="${apiUrl}"`,
    `export LTCG_API_KEY="${key}"`,
    "export LTCG_RUNTIME=milady-elizaos",
  ].join("\n");
}

function buildX402SolanaEnvSnippet() {
  return [
    "export LTCG_X402_ENABLED=true",
    "export LTCG_X402_SOLANA_NETWORK=mainnet",
    "export LTCG_X402_SOLANA_PRIVATE_KEY_B58=\"<base58-private-key>\"",
    "# Optional: export LTCG_X402_SOLANA_RPC_URL=\"https://your-rpc.example\"",
  ].join("\n");
}

function buildSmokeTestSnippet(apiUrl: string, key: string) {
  return `curl -s -H "Authorization: Bearer ${key}" "${apiUrl}/api/agent/me"`;
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
  const [newAgentName, setNewAgentName] = useState(() => randomAgentName());
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [lastMatchId, setLastMatchId] = useState<string | null>(null);
  const [lastSeat, setLastSeat] = useState<"host" | "away" | null>(null);

  const onboardingApiUrl =
    apiBaseUrl?.replace(/\/$/, "") ?? "https://your-convex-site.convex.site";
  const onboardingApiKey =
    (createdApiKey ?? apiKey ?? manualApiKey.trim()) || "ltcg_your_agent_key";

  const openClawdEnvSnippet = useMemo(
    () => buildOpenClawdEnvSnippet(onboardingApiUrl, onboardingApiKey),
    [onboardingApiKey, onboardingApiUrl],
  );
  const elizaEnvSnippet = useMemo(
    () => buildElizaEnvSnippet(onboardingApiUrl, onboardingApiKey),
    [onboardingApiKey, onboardingApiUrl],
  );
  const x402SolanaSnippet = useMemo(() => buildX402SolanaEnvSnippet(), []);
  const smokeTestSnippet = useMemo(
    () => buildSmokeTestSnippet(onboardingApiUrl, onboardingApiKey),
    [onboardingApiKey, onboardingApiUrl],
  );

  useEffect(() => {
    if (!copiedLabel) return;
    const timeout = window.setTimeout(() => setCopiedLabel(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [copiedLabel]);

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

  const myWaitingLobbies = useMemo(() => {
    if (!snapshot) return [];
    return openLobbies.filter(
      (lobby) =>
        lobby.hostUserId === snapshot.currentUser.userId &&
        lobby.status === "waiting",
    );
  }, [openLobbies, snapshot]);

  const activeStoryMatches = useMemo(() => {
    if (!snapshot?.activeStoryMatches) return [];
    return [...snapshot.activeStoryMatches].sort((a, b) => b.stageNumber - a.stageNumber);
  }, [snapshot?.activeStoryMatches]);

  const handleConnect = useCallback(() => {
    setError("");
    setApiKey(manualApiKey);
  }, [manualApiKey, setApiKey]);

  const handleCopySnippet = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLabel(label);
    } catch {
      setCopiedLabel("Clipboard unavailable");
    }
  }, []);

  const handleRegisterAndConnect = useCallback(async () => {
    if (!apiBaseUrl) {
      setError("Missing API base URL for registration.");
      return;
    }

    setError("");
    setBusyKey("register");
    try {
      const name = newAgentName.trim() || randomAgentName();
      const registration = await agentFetch<RegisteredAgentResponse>({
        apiBaseUrl,
        path: "/api/agent/register",
        method: "POST",
        body: { name },
      });

      if (!registration.apiKey) {
        throw new Error("Registration did not return an API key.");
      }

      setCreatedApiKey(registration.apiKey);
      setManualApiKey(registration.apiKey);
      setApiKey(registration.apiKey);
      setNewAgentName(randomAgentName());
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to register new agent session.",
      );
    } finally {
      setBusyKey(null);
    }
  }, [apiBaseUrl, newAgentName, setApiKey]);

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

  const handleCreatePvpLobby = useCallback(async () => {
    if (!apiBaseUrl || !apiKey) return;
    setError("");
    setBusyKey("create");
    try {
      const result = await agentFetch<CreatedPvpLobby>({
        apiBaseUrl,
        apiKey,
        path: "/api/agent/game/pvp/create",
        method: "POST",
      });
      setLastMatchId(result.matchId);
      setLastSeat("host");
      await loadSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to create PvP lobby.");
    } finally {
      setBusyKey(null);
    }
  }, [apiBaseUrl, apiKey, loadSnapshot]);

  const handleCancelLobby = useCallback(
    async (matchId: string) => {
      if (!apiBaseUrl || !apiKey) return;
      setError("");
      setBusyKey(`cancel:${matchId}`);
      try {
        await agentFetch({
          apiBaseUrl,
          apiKey,
          path: "/api/agent/game/pvp/cancel",
          method: "POST",
          body: { matchId },
        });
        if (lastMatchId === matchId) {
          setLastMatchId(null);
          setLastSeat(null);
        }
        await loadSnapshot();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to cancel PvP lobby.");
      } finally {
        setBusyKey(null);
      }
    },
    [apiBaseUrl, apiKey, lastMatchId, loadSnapshot],
  );

  const handleStartNextStoryMatch = useCallback(async () => {
    if (!apiBaseUrl || !apiKey) return;
    setError("");
    setBusyKey("story");
    try {
      const nextStage = await agentFetch<StoryNextStageResponse>({
        apiBaseUrl,
        apiKey,
        path: "/api/agent/story/next-stage",
      });

      if (nextStage.done || !nextStage.chapterId || !nextStage.stageNumber) {
        throw new Error("Story mode is complete for this agent.");
      }

      const result = await agentFetch<{ matchId: string }>({
        apiBaseUrl,
        apiKey,
        path: "/api/agent/game/start",
        method: "POST",
        body: {
          chapterId: nextStage.chapterId,
          stageNumber: nextStage.stageNumber,
        },
      });

      setLastMatchId(result.matchId);
      setLastSeat("host");
      await loadSnapshot();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to start next story match.",
      );
    } finally {
      setBusyKey(null);
    }
  }, [apiBaseUrl, apiKey, loadSnapshot]);

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
        setLastMatchId(matchId);
        setLastSeat("away");
        await loadSnapshot();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to join lobby.");
      } finally {
        setBusyKey(null);
      }
    },
    [apiBaseUrl, apiKey, loadSnapshot],
  );

  const lastHostOverlay = useMemo(
    () => (lastMatchId ? buildStreamOverlayUrl({ matchId: lastMatchId, seat: "host" }) : null),
    [lastMatchId],
  );
  const lastAwayOverlay = useMemo(
    () => (lastMatchId ? buildStreamOverlayUrl({ matchId: lastMatchId, seat: "away" }) : null),
    [lastMatchId],
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
            <div className="relative space-y-5">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider font-black text-[#121212]">
                  Step 1 (Recommended): Create Agent Key
                </p>
                <p className="text-[11px] text-[#555]">
                  One click creates an agent account, issues an <span className="font-mono">ltcg_</span> key, and connects this lobby.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newAgentName}
                    onChange={(event) => setNewAgentName(event.target.value)}
                    placeholder="agent name"
                    className="flex-1 border-2 border-[#121212] bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleRegisterAndConnect}
                    className="tcg-button-primary px-4 py-2 text-xs"
                    disabled={busyKey === "register"}
                  >
                    {busyKey === "register" ? "Creating..." : "Create + Connect"}
                  </button>
                </div>
                {createdApiKey && (
                  <div className="space-y-2 border border-[#121212]/20 bg-white/70 p-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#121212]">
                      New API key (save it now)
                    </p>
                    <input
                      type="text"
                      value={createdApiKey}
                      readOnly
                      className="w-full border-2 border-[#121212] bg-white px-3 py-2 text-[11px] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopySnippet("API key copied", createdApiKey)}
                      className="tcg-button px-3 py-2 text-[10px]"
                    >
                      Copy API Key
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t border-[#121212]/20 pt-4">
                <p className="text-xs uppercase tracking-wider font-black text-[#121212]">
                  Step 2: Connect Existing Key
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
                    onClick={() => {
                      setCreatedApiKey(null);
                      clearSession();
                    }}
                    className="tcg-button px-4 py-2 text-xs"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#121212]/20 pt-4">
                <p className="text-xs uppercase tracking-wider font-black text-[#121212]">
                  Step 3: Boot Runtime (OpenClawd + milady/elizaOS parity)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopySnippet("OpenClawd env copied", openClawdEnvSnippet)}
                    className="tcg-button px-3 py-2 text-[10px]"
                  >
                    Copy OpenClawd Env
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopySnippet("milady/elizaOS env copied", elizaEnvSnippet)}
                    className="tcg-button px-3 py-2 text-[10px]"
                  >
                    Copy milady/elizaOS Env
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopySnippet("Solana x402 env copied", x402SolanaSnippet)}
                    className="tcg-button px-3 py-2 text-[10px]"
                  >
                    Copy Solana x402 Env
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopySnippet("Smoke test copied", smokeTestSnippet)}
                    className="tcg-button px-3 py-2 text-[10px]"
                  >
                    Copy Smoke Test
                  </button>
                </div>
                <p className="text-[10px] text-[#666] font-mono break-all">{smokeTestSnippet}</p>
                <p className="text-[10px] text-[#666]">
                  Wallet safety: keep Solana private keys only in runtime secret stores. Never paste private keys into chat or browser forms.
                </p>
                {copiedLabel && (
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#121212]">
                    {copiedLabel}
                  </p>
                )}
              </div>

              {sessionError && (
                <p className="text-xs font-bold uppercase text-red-600">{sessionError}</p>
              )}
              {error && <p className="text-xs font-bold uppercase text-red-600">{error}</p>}
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

        <section
          className="relative border-2 border-[#121212] p-4 mb-4"
          style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
        >
          <div className="absolute inset-0 bg-white/86 pointer-events-none" />
          <div className="relative flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wider font-black text-[#121212]">
              Agent Onboarding Complete
            </p>
            <p className="text-[11px] text-[#555]">
              Next fastest path: create/join lobby, run story or PvP actions, and open spectator overlays.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopySnippet("OpenClawd env copied", openClawdEnvSnippet)}
                className="tcg-button px-3 py-2 text-[10px]"
              >
                Copy OpenClawd Env
              </button>
              <button
                type="button"
                onClick={() => handleCopySnippet("milady/elizaOS env copied", elizaEnvSnippet)}
                className="tcg-button px-3 py-2 text-[10px]"
              >
                Copy milady/elizaOS Env
              </button>
              <button
                type="button"
                onClick={() => handleCopySnippet("Solana x402 env copied", x402SolanaSnippet)}
                className="tcg-button px-3 py-2 text-[10px]"
              >
                Copy Solana x402 Env
              </button>
              <button
                type="button"
                onClick={() => handleCopySnippet("Smoke test copied", smokeTestSnippet)}
                className="tcg-button px-3 py-2 text-[10px]"
              >
                Copy Smoke Test
              </button>
              {copiedLabel && (
                <span className="text-[10px] font-black uppercase tracking-wider text-[#121212]">
                  {copiedLabel}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#666]">
              Solana wallet keys stay runtime-side. Lobby/API only sees wallet addresses and signed x402 requests.
            </p>
          </div>
        </section>

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
                  <button
                    type="button"
                    onClick={handleCreatePvpLobby}
                    disabled={myWaitingLobbies.length > 0 || busyKey === "create"}
                    className="tcg-button-primary px-4 py-2 text-[11px] disabled:opacity-60"
                  >
                    {busyKey === "create" ? "Creating..." : "Create PvP Lobby"}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartNextStoryMatch}
                    disabled={busyKey === "story"}
                    className="tcg-button-primary px-4 py-2 text-[11px] disabled:opacity-60"
                  >
                    {busyKey === "story" ? "Launching..." : "Start Next Story"}
                  </button>
                  {myWaitingLobbies[0] && (
                    <button
                      type="button"
                      onClick={() => handleCancelLobby(myWaitingLobbies[0].matchId)}
                      disabled={busyKey === `cancel:${myWaitingLobbies[0].matchId}`}
                      className="tcg-button px-4 py-2 text-[11px] disabled:opacity-60"
                    >
                      {busyKey === `cancel:${myWaitingLobbies[0].matchId}`
                        ? "Cancelling..."
                        : "Cancel My Lobby"}
                    </button>
                  )}
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
              {lastMatchId && (
                <div className="relative mt-3 pt-3 border-t border-[#121212]/20 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-black uppercase tracking-wider">
                    Last match: {lastMatchId} ({lastSeat ?? "unknown"})
                  </span>
                  {lastHostOverlay && (
                    <a
                      href={lastHostOverlay}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tcg-button px-3 py-1.5 text-[10px]"
                    >
                      Host Overlay
                    </a>
                  )}
                  {lastAwayOverlay && (
                    <a
                      href={lastAwayOverlay}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tcg-button px-3 py-1.5 text-[10px]"
                    >
                      Away Overlay
                    </a>
                  )}
                </div>
              )}
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

                  <div className="mt-5 pt-4 border-t border-[#121212]/20">
                    <p className="text-xs uppercase tracking-wider font-black text-[#121212] mb-3">
                      Active Story Arenas
                    </p>
                    {activeStoryMatches.length === 0 ? (
                      <p
                        className="text-xs text-[#555]"
                        style={{ fontFamily: "Special Elite, cursive" }}
                      >
                        No active story runs right now.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeStoryMatches.map((storyMatch) => {
                          const hostOverlay = buildStreamOverlayUrl({
                            matchId: storyMatch.matchId,
                            seat: "host",
                          });
                          return (
                            <div
                              key={storyMatch.matchId}
                              className="border border-[#121212]/30 bg-white/70 px-3 py-2 flex flex-col gap-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wider">
                                    {storyMatch.playerUsername}
                                  </p>
                                  <p className="text-[11px] text-[#666]">
                                    Chapter {storyMatch.chapterId} • Stage {storyMatch.stageNumber}
                                  </p>
                                  <p className="text-[11px] text-[#555] font-mono">
                                    {storyMatch.matchId}
                                  </p>
                                </div>
                                <span
                                  className={`px-2 py-1 text-[10px] uppercase font-black ${
                                    storyMatch.status === "waiting"
                                      ? "bg-[#ffcc00] text-[#121212]"
                                      : "bg-[#121212] text-white"
                                  }`}
                                >
                                  {storyMatch.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <a
                                  href={hostOverlay}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tcg-button px-3 py-2 text-[10px]"
                                >
                                  Story Overlay
                                </a>
                                {storyMatch.retake.pipelineEnabled &&
                                  storyMatch.retake.streamUrl && (
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
