import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import * as Sentry from "@sentry/react";
import { apiAny, useConvexMutation, useConvexQuery } from "@/lib/convexHelpers";
import { TrayNav } from "@/components/layout/TrayNav";
import { detectClientPlatform, describeClientPlatform } from "@/lib/clientPlatform";
import { normalizeMatchId } from "@/lib/matchIds";
import { useMatchPresence } from "@/hooks/useMatchPresence";

type CurrentUser = {
  _id: string;
};

type MatchMeta = {
  _id: string;
  status: "waiting" | "active" | "ended";
  mode: "pvp" | "story";
  hostId: string;
  awayId: string | null;
};

export function Duel() {
  const navigate = useNavigate();
  const currentUser = useConvexQuery(apiAny.auth.currentUser, {}) as CurrentUser | null | undefined;
  const activeMatch = useConvexQuery(
    apiAny.game.getActiveMatchByHost,
    currentUser?._id ? { hostId: currentUser._id } : "skip",
  ) as MatchMeta | null | undefined;
  const openLobby = useConvexQuery(
    apiAny.game.getMyOpenPvPLobby,
    currentUser ? {} : "skip",
  ) as MatchMeta | null | undefined;

  const createLobby = useConvexMutation(apiAny.game.createPvPLobby);
  const joinLobby = useConvexMutation(apiAny.game.joinPvPMatch);

  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const waitingLobbyId = useMemo(() => {
    if (!openLobby || openLobby.status !== "waiting") return null;
    return String(openLobby._id);
  }, [openLobby]);

  useMatchPresence(waitingLobbyId);

  const platform = detectClientPlatform();
  const source = describeClientPlatform();

  const handleCreateLobby = async () => {
    setBusy("create");
    setError("");
    try {
      const created = await createLobby({ platform, source }) as { matchId?: string };
      const matchId = normalizeMatchId(created?.matchId ?? null);
      if (!matchId) {
        throw new Error("No match ID was returned.");
      }
      navigate(`/play/${matchId}`);
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err?.message ?? "Failed to create lobby.");
    } finally {
      setBusy(null);
    }
  };

  const handleJoinLobby = async () => {
    setBusy("join");
    setError("");
    try {
      const matchId = normalizeMatchId(joinCode);
      if (!matchId) {
        throw new Error("Enter a valid match ID.");
      }
      await joinLobby({ matchId, platform, source });
      navigate(`/play/${matchId}`);
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err?.message ?? "Failed to join lobby.");
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    if (!waitingLobbyId) return;
    await navigator.clipboard.writeText(waitingLobbyId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (currentUser === undefined || activeMatch === undefined || openLobby === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfdfb]">
        <div className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const resumableMatchId =
    activeMatch?.status === "active" && activeMatch.mode === "pvp"
      ? String(activeMatch._id)
      : null;

  return (
    <div className="min-h-screen bg-[#fdfdfb] pb-24 px-4 md:px-6">
      <div className="max-w-2xl mx-auto pt-8 space-y-4">
        <header className="paper-panel p-5">
          <p className="text-xs uppercase tracking-wider text-[#666] font-bold">PvP Cross-Platform</p>
          <h1
            className="text-3xl font-black uppercase tracking-tighter text-[#121212]"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Duel Lobby
          </h1>
          <p className="text-sm text-[#666] mt-2" style={{ fontFamily: "Special Elite, cursive" }}>
            Web, Telegram, and Discord players can join the same live match.
          </p>
        </header>

        {resumableMatchId && (
          <section className="paper-panel p-4 border-2 border-[#121212]">
            <p className="text-xs uppercase tracking-wider font-bold text-[#121212]">
              Active Duel Found
            </p>
            <p className="text-[11px] text-[#666] font-mono break-all mt-2">{resumableMatchId}</p>
            <button
              type="button"
              onClick={() => navigate(`/play/${resumableMatchId}`)}
              className="tcg-button-primary px-4 py-2 text-xs mt-3"
            >
              Resume Match
            </button>
          </section>
        )}

        <section className="paper-panel p-5 border-2 border-[#121212]">
          <p className="text-xs uppercase tracking-wider font-bold text-[#121212]">Host a Duel</p>
          <p className="text-xs text-[#666] mt-1">
            Create a waiting lobby and share the match ID.
          </p>
          <button
            type="button"
            onClick={handleCreateLobby}
            disabled={busy !== null}
            className="tcg-button-primary px-4 py-2 text-xs mt-3 disabled:opacity-60"
          >
            {busy === "create" ? "Creating..." : "Create Lobby"}
          </button>

          {waitingLobbyId && (
            <div className="mt-4 border-2 border-[#121212] bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#666]">
                Waiting Lobby
              </p>
              <p className="font-mono text-xs break-all text-[#121212] mt-1">{waitingLobbyId}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="tcg-button px-3 py-1 text-[10px]"
                >
                  {copied ? "Copied" : "Copy Match ID"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/play/${waitingLobbyId}`)}
                  className="tcg-button-primary px-3 py-1 text-[10px]"
                >
                  Open Match
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="paper-panel p-5 border-2 border-[#121212]">
          <p className="text-xs uppercase tracking-wider font-bold text-[#121212]">Join by Match ID</p>
          <p className="text-xs text-[#666] mt-1">Paste an invite code from any client.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="match id"
              className="flex-1 border-2 border-[#121212] bg-white px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={handleJoinLobby}
              disabled={busy !== null}
              className="tcg-button-primary px-4 py-2 text-xs disabled:opacity-60"
            >
              {busy === "join" ? "Joining..." : "Join"}
            </button>
          </div>
        </section>

        {error && (
          <div className="paper-panel border-2 border-red-600 bg-red-50 p-3">
            <p className="text-xs font-bold uppercase text-red-600">{error}</p>
          </div>
        )}
      </div>
      <TrayNav />
    </div>
  );
}
