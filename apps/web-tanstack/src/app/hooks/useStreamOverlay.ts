/**
 * Data hook for the stream overlay page.
 *
 * Combines agent discovery, spectator view, card lookup, timeline,
 * and stream chat messages into a single hook.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexHelpers";
import {
  useAgentSpectator,
  type PublicSpectatorView,
  type PublicEventLogEntry,
} from "@/hooks/useAgentSpectator";
import type { CardDefinition } from "@/lib/convexTypes";
import {
  spectatorMonstersToBoardCards,
  spectatorSpellTrapsToCards,
} from "@/lib/spectatorAdapter";
import type { BoardCard } from "@/components/game/types";
import type { SpectatorSpellTrapCard } from "@/lib/spectatorAdapter";
import { useCardLookup } from "@/hooks/useCardLookup";
import type { StreamOverlayParams } from "@/lib/streamOverlayParams";

export type StreamChatMessage = {
  _id: string;
  role: "agent" | "viewer" | "system";
  senderName: string;
  text: string;
  source: string;
  createdAt: number;
};

export type StreamAudioControl = {
  agentId: string;
  playbackIntent: "playing" | "paused" | "stopped";
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
  updatedAt: number;
};

export interface StreamOverlayData {
  loading: boolean;
  error: string | null;
  agentName: string | null;
  agentId: string | null;
  matchState: PublicSpectatorView | null;
  timeline: PublicEventLogEntry[];
  cardLookup: Record<string, CardDefinition>;
  chatMessages: StreamChatMessage[];
  streamAudioControl: StreamAudioControl | null;
  // Pre-adapted board data
  agentMonsters: BoardCard[];
  opponentMonsters: BoardCard[];
  agentSpellTraps: SpectatorSpellTrapCard[];
  opponentSpellTraps: SpectatorSpellTrapCard[];
}

const CONVEX_SITE_URL = (import.meta.env.VITE_CONVEX_URL ?? "")
  .replace(".convex.cloud", ".convex.site");

function normalizeApiUrl(value: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\/$/, "");
  return trimmed.length > 0 ? trimmed.replace(".convex.cloud", ".convex.site") : null;
}

async function fetchStreamAudioControl(args: {
  apiUrl: string;
  matchId: string;
  apiKey?: string | null;
}): Promise<StreamAudioControl | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (args.apiKey) {
    headers.Authorization = `Bearer ${args.apiKey}`;
  }

  const response = await fetch(
    `${args.apiUrl}/api/agent/stream/audio?matchId=${encodeURIComponent(args.matchId)}`,
    {
      method: "GET",
      headers,
    },
  );

  if (response.status === 404 || response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Failed to load stream audio control (${response.status})`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") return null;

  return {
    agentId: String((payload as Record<string, unknown>).agentId ?? ""),
    playbackIntent:
      (payload as Record<string, unknown>).playbackIntent === "paused" ||
      (payload as Record<string, unknown>).playbackIntent === "stopped"
        ? ((payload as Record<string, unknown>).playbackIntent as "paused" | "stopped")
        : "playing",
    musicVolume: Number((payload as Record<string, unknown>).musicVolume ?? 0.65),
    sfxVolume: Number((payload as Record<string, unknown>).sfxVolume ?? 0.8),
    musicMuted: Boolean((payload as Record<string, unknown>).musicMuted ?? false),
    sfxMuted: Boolean((payload as Record<string, unknown>).sfxMuted ?? false),
    updatedAt: Number((payload as Record<string, unknown>).updatedAt ?? 0),
  };
}

export function useStreamOverlay(params: StreamOverlayParams): StreamOverlayData {
  const apiUrl = normalizeApiUrl(params.apiUrl) ?? normalizeApiUrl(CONVEX_SITE_URL) ?? null;
  const { agent, matchState, timeline, error, loading } = useAgentSpectator({
    apiKey: params.apiKey,
    apiUrl,
    hostId: params.hostId,
    matchId: params.matchId,
    seat: params.seat,
  });

  const { lookup: cardLookup, isLoaded: cardsLoaded } = useCardLookup();

  // Subscribe to stream chat messages (real-time via Convex)
  // Prefer direct agent stream identity, and fall back to match host mapping.
  const agentDocId = agent?.id ?? null;
  const rawMessagesByAgent = useQuery(
    apiAny.streamChat.getRecentStreamMessages,
    agentDocId ? { agentId: agentDocId, limit: 50 } : "skip",
  ) as StreamChatMessage[] | undefined;
  const rawMessagesByMatch = useQuery(
    apiAny.streamChat.getRecentStreamMessagesByMatch,
    !agentDocId && params.matchId ? { matchId: params.matchId, limit: 50 } : "skip",
  ) as StreamChatMessage[] | undefined;
  const chatMessages = rawMessagesByAgent ?? rawMessagesByMatch ?? [];

  const [streamAudioControl, setStreamAudioControl] = useState<StreamAudioControl | null>(null);

  useEffect(() => {
    let cancelled = false;
    const matchId = params.matchId?.trim();
    if (!apiUrl || !matchId) {
      setStreamAudioControl(null);
      return;
    }

    const load = async () => {
      try {
        const next = await fetchStreamAudioControl({
          apiUrl,
          matchId,
          apiKey: params.apiKey ?? null,
        });
        if (!cancelled) {
          setStreamAudioControl(next);
        }
      } catch {
        if (!cancelled) {
          // Never crash overlays for audio-control fetch failures.
          setStreamAudioControl(null);
        }
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [apiUrl, params.apiKey, params.matchId]);

  // Adapt spectator slots to rich board component shapes
  const agentMonsters = useMemo(
    () => matchState ? spectatorMonstersToBoardCards(matchState.fields.agent.monsters) : [],
    [matchState],
  );
  const opponentMonsters = useMemo(
    () => matchState ? spectatorMonstersToBoardCards(matchState.fields.opponent.monsters) : [],
    [matchState],
  );
  const agentSpellTraps = useMemo(
    () => matchState ? spectatorSpellTrapsToCards(matchState.fields.agent.spellTraps) : [],
    [matchState],
  );
  const opponentSpellTraps = useMemo(
    () => matchState ? spectatorSpellTrapsToCards(matchState.fields.opponent.spellTraps) : [],
    [matchState],
  );

  const shouldWaitForCards = !params.apiUrl;

  return {
    loading: loading || (shouldWaitForCards && !cardsLoaded),
    error,
    agentName: agent?.name ?? null,
    agentId: agentDocId,
    matchState,
    timeline,
    cardLookup,
    chatMessages,
    streamAudioControl,
    agentMonsters,
    opponentMonsters,
    agentSpellTraps,
    opponentSpellTraps,
  };
}
