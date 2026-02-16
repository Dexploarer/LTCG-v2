/**
 * ElizaOS Provider: injects current game state into the agent's LLM context.
 *
 * Runs before every action selection, giving the LLM full visibility into
 * the board state, hand, LP, phase, and turn info.
 */

import { getClient, type LTCGClient } from "./client.js";
import type {
  BoardCard,
  CardInHand,
  IAgentRuntime,
  Memory,
  PlayerView,
  Provider,
  State,
} from "./types.js";

export const gameStateProvider: Provider = {
  name: "ltcg-game-state",
  description:
    "Current LunchTable card game state — board, hand, LP, phase, and turn",

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ) => {
    let client: LTCGClient;
    try {
      client = getClient();
    } catch {
      return { text: "" };
    }

    const matchId = client.currentMatchId;
    if (!matchId) {
      return {
        text: "No active LunchTable match. Use START_LTCG_BATTLE to begin a story battle.",
      };
    }

    try {
      const view = await client.getView(matchId, "host");
      const phase = resolvePhase(view);
      return {
        text: formatView(view, matchId),
        values: {
          ltcgMatchId: matchId,
          ltcgPhase: phase,
          ltcgIsMyTurn: String(view.currentTurnPlayer === "host"),
        },
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      return {
        text: `Active match ${matchId} — unable to fetch state: ${reason}`,
      };
    }
  },
};

// ── Formatting ───────────────────────────────────────────────────

function formatView(v: PlayerView, matchId: string): string {
  const phase = resolvePhase(v);
  if (v.gameOver) {
    const myLP = v.players.host.lifePoints;
    const oppLP = v.players.away.lifePoints;
    const outcome =
      myLP > oppLP ? "VICTORY!" : myLP < oppLP ? "DEFEAT." : "DRAW.";
    return `=== LTCG MATCH ${matchId} — GAME OVER ===\nFinal LP: You ${myLP} — Opponent ${oppLP}\n${outcome}`;
  }

  const isMyTurn = v.currentTurnPlayer === "host";
  const lines: string[] = [
    `=== LTCG MATCH ${matchId} ===`,
    `Phase: ${phase} | ${isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}`,
    `LP: You ${v.players.host.lifePoints} | Opponent ${v.players.away.lifePoints}`,
    "",
  ];

  // Hand — grouped by card type
  const hand = v.hand ?? [];
  const monsters = hand.filter((c) => c.cardType === "stereotype");
  const spells = hand.filter((c) => c.cardType === "spell");
  const traps = hand.filter((c) => c.cardType === "trap");

  lines.push(`Your hand (${hand.length}):`);
  if (hand.length === 0) {
    lines.push("  (empty)");
  } else {
    for (const c of monsters) lines.push(`  ${formatHandCard(c)}`);
    for (const c of spells) lines.push(`  ${formatHandCard(c)}`);
    for (const c of traps) lines.push(`  ${formatHandCard(c)}`);
  }

  // Player field
  lines.push("");
  const myMonsters = (v.playerField?.monsters ?? []).filter(
    Boolean,
  ) as BoardCard[];
  lines.push(`Your field (${myMonsters.length} monsters):`);
  if (myMonsters.length === 0) {
    lines.push("  (empty)");
  } else {
    for (const m of myMonsters) {
      lines.push(
        `  ${m.name} ATK:${m.attack} DEF:${m.defense} pos:${m.position ?? "atk"} id:${m.instanceId}`,
      );
    }
  }

  // Opponent field
  lines.push("");
  const oppMonsters = (v.opponentField?.monsters ?? []).filter(
    Boolean,
  ) as BoardCard[];
  lines.push(`Opponent field (${oppMonsters.length} monsters):`);
  if (oppMonsters.length === 0) {
    lines.push("  (empty)");
  } else {
    for (const m of oppMonsters) {
      if (m.faceDown) {
        lines.push("  [Face-down monster]");
      } else {
        lines.push(`  ${m.name} ATK:${m.attack} DEF:${m.defense}`);
      }
    }
  }

  return lines.join("\n");
}

function formatHandCard(c: CardInHand): string {
  if (c.cardType === "stereotype") {
    return `${c.name} (ATK:${c.attack ?? "?"} DEF:${c.defense ?? "?"} Lv:${c.level ?? "?"} id:${c.instanceId})`;
  }
  return `${c.name} [${c.cardType}] (id:${c.instanceId})`;
}

type PhaseView = { currentPhase?: string; phase?: string };

function resolvePhase(view: PhaseView): string {
  return view.currentPhase ?? view.phase ?? "draw";
}
