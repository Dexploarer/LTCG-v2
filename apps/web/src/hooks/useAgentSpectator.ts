import { useState, useEffect, useRef, useCallback } from "react";

type Seat = "host" | "away";

export type PublicSpectatorSlot = {
  lane: number;
  occupied: boolean;
  faceDown: boolean;
  position: "attack" | "defense" | null;
  name: string | null;
  attack: number | null;
  defense: number | null;
  kind: "monster" | "spell" | "trap" | "card" | null;
};

export type PublicSpectatorView = {
  matchId: string;
  seat: Seat;
  status: string | null;
  mode: string | null;
  phase: string;
  turnNumber: number;
  gameOver: boolean;
  winner: Seat | null;
  isAgentTurn: boolean;
  chapterId: string | null;
  stageNumber: number | null;
  players: {
    agent: {
      lifePoints: number;
      deckCount: number;
      handCount: number;
      graveyardCount: number;
      banishedCount: number;
    };
    opponent: {
      lifePoints: number;
      deckCount: number;
      handCount: number;
      graveyardCount: number;
      banishedCount: number;
    };
  };
  fields: {
    agent: {
      monsters: PublicSpectatorSlot[];
      spellTraps: PublicSpectatorSlot[];
    };
    opponent: {
      monsters: PublicSpectatorSlot[];
      spellTraps: PublicSpectatorSlot[];
    };
  };
};

export type PublicEventLogEntry = {
  version: number;
  createdAt: number | null;
  actor: "agent" | "opponent" | "system";
  eventType: string;
  summary: string;
  rationale: string;
};

type ActiveMatchResponse = {
  matchId: string | null;
  seat?: Seat | null;
};

export function clampSeat(value: unknown): Seat | null {
  return value === "host" || value === "away" ? value : null;
}

const POLL_INTERVAL_MS = 2000;
const TIMELINE_LIMIT = 120;

export function appendTimelineEntries(
  previous: PublicEventLogEntry[],
  incoming: PublicEventLogEntry[],
  limit = TIMELINE_LIMIT,
) {
  return [...previous, ...incoming].slice(-limit);
}

export interface SpectatorAgent {
  id: string;
  name: string;
  apiKeyPrefix: string;
}

export function useAgentSpectator(apiKey: string | null, apiUrl: string | null) {
  const [agent, setAgent] = useState<SpectatorAgent | null>(null);
  const [matchState, setMatchState] = useState<PublicSpectatorView | null>(null);
  const [timeline, setTimeline] = useState<PublicEventLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeMatchId = useRef<string | null>(null);
  const activeMatchSeat = useRef<Seat | null>(null);
  const eventCursor = useRef(0);
  const mountedRef = useRef(true);

  const apiFetch = useCallback(
    async (path: string) => {
      if (!apiKey || !apiUrl) return null;
      const url = `${apiUrl.replace(/\/$/, "")}${path}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return response.json();
    },
    [apiKey, apiUrl],
  );

  const resetTimeline = useCallback(() => {
    eventCursor.current = 0;
    setTimeline([]);
  }, []);

  useEffect(() => {
    if (!apiKey || !apiUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const me = await apiFetch("/api/agent/me");
        if (cancelled) return;
        if (!me) {
          setError("Invalid API key");
          setLoading(false);
          return;
        }

        setAgent({
          id: String(me.id),
          name: String(me.name ?? "Agent"),
          apiKeyPrefix: String(me.apiKeyPrefix ?? ""),
        });
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Failed to connect");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [apiKey, apiUrl, apiFetch]);

  useEffect(() => {
    if (!agent) return;
    mountedRef.current = true;

    async function poll() {
      if (!mountedRef.current) return;

      try {
        if (activeMatchId.current) {
          const query = new URLSearchParams({
            matchId: activeMatchId.current,
          });
          if (activeMatchSeat.current) {
            query.set("seat", activeMatchSeat.current);
          }

          const view = (await apiFetch(
            `/api/agent/game/public-view?${query.toString()}`,
          )) as PublicSpectatorView | null;
          if (!mountedRef.current) return;

          if (view) {
            setMatchState(view);
            activeMatchSeat.current = clampSeat(view.seat) ?? activeMatchSeat.current;

            const eventsQuery = new URLSearchParams({
              matchId: activeMatchId.current,
              sinceVersion: String(eventCursor.current),
            });
            if (activeMatchSeat.current) {
              eventsQuery.set("seat", activeMatchSeat.current);
            }

            const events = (await apiFetch(
              `/api/agent/game/public-events?${eventsQuery.toString()}`,
            )) as PublicEventLogEntry[] | null;
            if (!mountedRef.current) return;

            if (Array.isArray(events) && events.length > 0) {
              let maxVersion = eventCursor.current;
              for (const entry of events) {
                maxVersion = Math.max(maxVersion, Number(entry.version ?? 0));
              }
              eventCursor.current = maxVersion;
              setTimeline((prev) => appendTimelineEntries(prev, events, TIMELINE_LIMIT));
            }

            return;
          }

          activeMatchId.current = null;
          activeMatchSeat.current = null;
          setMatchState(null);
          resetTimeline();
        }

        const activeMatch = (await apiFetch(
          "/api/agent/active-match",
        )) as ActiveMatchResponse | null;
        if (!mountedRef.current || !activeMatch) return;

        if (typeof activeMatch.matchId === "string" && activeMatch.matchId.trim()) {
          if (activeMatchId.current !== activeMatch.matchId) {
            resetTimeline();
          }
          activeMatchId.current = activeMatch.matchId;
          activeMatchSeat.current = clampSeat(activeMatch.seat);
        }
      } catch {
        // Keep polling on transient network failures.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [agent, apiFetch, resetTimeline]);

  const watchMatch = useCallback(
    (matchId: string, seat?: Seat) => {
      activeMatchId.current = matchId;
      activeMatchSeat.current = clampSeat(seat);
      setMatchState(null);
      resetTimeline();
    },
    [resetTimeline],
  );

  return {
    agent,
    matchState,
    timeline,
    error,
    loading,
    watchMatch,
  };
}
