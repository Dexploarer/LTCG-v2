import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { apiAny, useConvexMutation, useConvexQuery } from "@/lib/convexHelpers";
import { TrayNav } from "@/components/layout/TrayNav";
import { LANDING_BG, MENU_TEXTURE } from "@/lib/blobUrls";

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
};

type JoinResult = {
  matchId: string;
  seat: "away";
  mode: "pvp";
  status: "active";
};

type CreateResult = {
  matchId: string;
  visibility: "public" | "private";
  joinCode: string | null;
  status: "waiting";
  createdAt: number;
};

export function Pvp() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const myLobby = useConvexQuery(apiAny.game.getMyPvpLobby, {}) as PvpLobbySummary | null | undefined;
  const openLobbies = useConvexQuery(apiAny.game.listOpenPvpLobbies, {}) as PvpLobbySummary[] | undefined;

  const createPvpLobby = useConvexMutation(apiAny.game.createPvpLobby);
  const joinPvpLobby = useConvexMutation(apiAny.game.joinPvpLobby);
  const joinPvpLobbyByCode = useConvexMutation(apiAny.game.joinPvpLobbyByCode);
  const cancelPvpLobby = useConvexMutation(apiAny.game.cancelPvpLobby);

  const canCreate = !myLobby || myLobby.status !== "waiting";
  const sortedOpenLobbies = useMemo(
    () => [...(openLobbies ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [openLobbies],
  );

  useEffect(() => {
    if (myLobby?.status === "active") {
      navigate(`/play/${myLobby.matchId}`);
    }
  }, [myLobby?.status, myLobby?.matchId, navigate]);

  const clearFlash = useCallback(() => {
    setTimeout(() => {
      setMessage("");
      setCopied("");
    }, 1800);
  }, []);

  const handleCreateLobby = useCallback(
    async (visibility: "public" | "private") => {
      setError("");
      setMessage("");
      setCopied("");
      setBusyKey(`create:${visibility}`);
      try {
        const created = (await createPvpLobby({
          visibility,
        })) as CreateResult;
        setMessage(
          visibility === "private"
            ? `Private lobby ready. Join code: ${created.joinCode ?? "n/a"}`
            : "Public lobby created.",
        );
        clearFlash();
      } catch (err: any) {
        setError(err?.message ?? "Failed to create lobby.");
      } finally {
        setBusyKey(null);
      }
    },
    [clearFlash, createPvpLobby],
  );

  const handleJoinLobby = useCallback(
    async (matchId: string) => {
      setError("");
      setMessage("");
      setCopied("");
      setBusyKey(`join:${matchId}`);
      try {
        const result = (await joinPvpLobby({ matchId })) as JoinResult;
        navigate(`/play/${result.matchId}`);
      } catch (err: any) {
        setError(err?.message ?? "Failed to join lobby.");
      } finally {
        setBusyKey(null);
      }
    },
    [joinPvpLobby, navigate],
  );

  const handleJoinByCode = useCallback(async () => {
    const normalizedCode = joinCode.trim().toUpperCase();
    if (!normalizedCode) {
      setError("Enter a lobby code first.");
      return;
    }

    setError("");
    setMessage("");
    setCopied("");
    setBusyKey("join:code");
    try {
      const result = (await joinPvpLobbyByCode({
        joinCode: normalizedCode,
      })) as JoinResult;
      navigate(`/play/${result.matchId}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to join by code.");
    } finally {
      setBusyKey(null);
    }
  }, [joinCode, joinPvpLobbyByCode, navigate]);

  const handleCancelLobby = useCallback(async () => {
    if (!myLobby?.matchId) return;
    setError("");
    setMessage("");
    setCopied("");
    setBusyKey("cancel");
    try {
      await cancelPvpLobby({ matchId: myLobby.matchId });
      setMessage("Lobby canceled.");
      clearFlash();
    } catch (err: any) {
      setError(err?.message ?? "Failed to cancel lobby.");
    } finally {
      setBusyKey(null);
    }
  }, [cancelPvpLobby, clearFlash, myLobby?.matchId]);

  const handleCopy = useCallback(async (value: string, label: "Join code" | "Match ID") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copied.`);
      clearFlash();
    } catch {
      setCopied("Clipboard unavailable.");
      clearFlash();
    }
  }, [clearFlash]);

  return (
    <div
      className="min-h-screen relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${LANDING_BG}')` }}
    >
      <div className="absolute inset-0 bg-black/75" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8 pb-24">
        <header className="text-center mb-6">
          <h1
            className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            PvP Lobby
          </h1>
          <p
            className="text-[#ffcc00] text-sm mt-2"
            style={{ fontFamily: "Special Elite, cursive" }}
          >
            Human vs Human duels + Human-hosted invites for Milady agents
          </p>
        </header>

        <section
          className="relative mb-5 p-5 border-2 border-[#121212]"
          style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
        >
          <div className="absolute inset-0 bg-white/82 pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-wider font-bold text-[#121212] mb-3">
              Create Lobby
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canCreate || busyKey !== null}
                onClick={() => handleCreateLobby("public")}
                className="tcg-button-primary px-4 py-2 text-xs disabled:opacity-60"
              >
                {busyKey === "create:public" ? "Creating..." : "Create Public Lobby"}
              </button>
              <button
                type="button"
                disabled={!canCreate || busyKey !== null}
                onClick={() => handleCreateLobby("private")}
                className="tcg-button px-4 py-2 text-xs disabled:opacity-60"
              >
                {busyKey === "create:private" ? "Creating..." : "Create Private Lobby"}
              </button>
            </div>
            {!canCreate && (
              <p className="text-[11px] text-[#555] mt-2">
                You already have a waiting/active lobby below.
              </p>
            )}
          </div>
        </section>

        <section
          className="relative mb-5 p-5 border-2 border-[#121212]"
          style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
        >
          <div className="absolute inset-0 bg-white/82 pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-wider font-bold text-[#121212] mb-3">
              Join Private Lobby
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="Enter 6-char code"
                className="border-2 border-[#121212] bg-white px-3 py-2 font-mono text-sm tracking-widest uppercase"
                maxLength={6}
              />
              <button
                type="button"
                onClick={handleJoinByCode}
                disabled={busyKey !== null}
                className="tcg-button px-4 py-2 text-xs disabled:opacity-60"
              >
                {busyKey === "join:code" ? "Joining..." : "Join by Code"}
              </button>
            </div>
          </div>
        </section>

        {myLobby?.status === "waiting" && (
          <section
            className="relative mb-5 p-5 border-2 border-[#121212]"
            style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
          >
            <div className="absolute inset-0 bg-white/82 pointer-events-none" />
            <div className="relative">
              <p className="text-xs uppercase tracking-wider font-bold text-[#121212] mb-2">
                Your Waiting Lobby
              </p>
              <p className="text-xs text-[#444] mb-1">
                Visibility: <span className="font-bold uppercase">{myLobby.visibility}</span>
              </p>
              {myLobby.joinCode && (
                <p className="text-xs text-[#444] mb-1">
                  Join code: <span className="font-mono font-bold">{myLobby.joinCode}</span>
                </p>
              )}
              <p className="text-xs text-[#444] mb-3">
                Match ID: <span className="font-mono">{myLobby.matchId}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {myLobby.joinCode && (
                  <button
                    type="button"
                    onClick={() => handleCopy(myLobby.joinCode!, "Join code")}
                    className="tcg-button px-3 py-2 text-[10px]"
                  >
                    Copy Join Code
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleCopy(myLobby.matchId, "Match ID")}
                  className="tcg-button px-3 py-2 text-[10px]"
                >
                  Copy Match ID
                </button>
                <button
                  type="button"
                  onClick={handleCancelLobby}
                  disabled={busyKey !== null}
                  className="tcg-button-primary px-3 py-2 text-[10px] disabled:opacity-60"
                >
                  {busyKey === "cancel" ? "Canceling..." : "Cancel Lobby"}
                </button>
              </div>
              <p className="text-[10px] text-[#555] mt-2">
                Agents can join this lobby via <span className="font-mono">JOIN_LTCG_MATCH</span> using the match ID.
              </p>
            </div>
          </section>
        )}

        <section
          className="relative p-5 border-2 border-[#121212]"
          style={{ backgroundImage: `url('${MENU_TEXTURE}')`, backgroundSize: "512px" }}
        >
          <div className="absolute inset-0 bg-white/82 pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-wider font-bold text-[#121212] mb-3">
              Open Public Lobbies
            </p>
            {sortedOpenLobbies.length === 0 ? (
              <p className="text-xs text-[#555]">No public lobbies are open right now.</p>
            ) : (
              <div className="space-y-2">
                {sortedOpenLobbies.map((lobby) => (
                  <div
                    key={lobby.matchId}
                    className="border border-[#121212]/30 bg-white/70 px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        Host: {lobby.hostUsername}
                      </p>
                      <p className="text-[11px] text-[#555] font-mono truncate">
                        {lobby.matchId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleJoinLobby(lobby.matchId)}
                      disabled={busyKey !== null}
                      className="tcg-button px-3 py-2 text-[10px] shrink-0 disabled:opacity-60"
                    >
                      {busyKey === `join:${lobby.matchId}` ? "Joining..." : "Join"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {(error || message || copied) && (
          <div className="mt-4 text-center">
            {error && <p className="text-xs font-bold text-red-300">{error}</p>}
            {!error && message && <p className="text-xs font-bold text-[#ffcc00]">{message}</p>}
            {!error && !message && copied && <p className="text-xs font-bold text-[#ffcc00]">{copied}</p>}
          </div>
        )}
      </div>

      <TrayNav />
    </div>
  );
}
