import { getClient } from "../client.js";
import { playOneTurn } from "../actions/turnLogic.js";
import { resolveLifePoints, ensureDeckSelected } from "../utils.js";
import type { MatchActive, PlayerView } from "../types.js";

export type AutonomyMode = "story" | "pvp";
export type AutonomyState = "idle" | "running" | "paused" | "stopping" | "error";

export interface AutonomyStatus {
  state: AutonomyState;
  mode: AutonomyMode | null;
  continuous: boolean;
  startedAt: number | null;
  lastError: string | null;
  matchId: string | null;
  seat: MatchActive["seat"] | null;
}

const MAX_TURNS = 150;
const POLL_DELAY_MS = 1500;
const PVP_LOBBY_WAIT_MS = 90_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class LTCGAutonomyController {
  private state: AutonomyState = "idle";
  private mode: AutonomyMode | null = null;
  private continuous = false;
  private startedAt: number | null = null;
  private lastError: string | null = null;
  private runPromise: Promise<void> | null = null;
  private stopRequested = false;
  private pauseSignal: { promise: Promise<void>; resolve: () => void } | null =
    null;

  getStatus(): AutonomyStatus {
    const client = (() => {
      try {
        return getClient();
      } catch {
        return null;
      }
    })();
    return {
      state: this.state,
      mode: this.mode,
      continuous: this.continuous,
      startedAt: this.startedAt,
      lastError: this.lastError,
      matchId: client?.currentMatchId ?? null,
      seat: client?.currentSeat ?? null,
    };
  }

  async start(args: { mode: AutonomyMode; continuous?: boolean }): Promise<void> {
    if (this.state !== "idle") {
      throw new Error(`Autonomy already active (${this.state}).`);
    }

    this.state = "running";
    this.mode = args.mode;
    this.continuous = Boolean(args.continuous);
    this.startedAt = Date.now();
    this.lastError = null;
    this.stopRequested = false;
    this.pauseSignal = null;

    this.runPromise = this.run().catch((err) => {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.state = "error";
    });
  }

  async pause(): Promise<void> {
    if (this.state !== "running") {
      throw new Error(`Cannot pause from state "${this.state}".`);
    }
    this.state = "paused";
    if (!this.pauseSignal) {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      this.pauseSignal = { promise, resolve };
    }
  }

  async resume(): Promise<void> {
    if (this.state !== "paused") {
      throw new Error(`Cannot resume from state "${this.state}".`);
    }
    this.state = "running";
    if (this.pauseSignal) {
      this.pauseSignal.resolve();
      this.pauseSignal = null;
    }
  }

  async stop(): Promise<void> {
    if (this.state === "idle") return;
    this.stopRequested = true;
    this.state = "stopping";
    if (this.pauseSignal) {
      this.pauseSignal.resolve();
      this.pauseSignal = null;
    }
    if (this.runPromise) {
      await this.runPromise;
    }
    try {
      getClient().setMatch(null);
    } catch {
      // ignore
    }
    this.resetToIdle();
  }

  private resetToIdle(): void {
    this.state = "idle";
    this.mode = null;
    this.continuous = false;
    this.startedAt = null;
    this.runPromise = null;
    this.stopRequested = false;
    this.pauseSignal = null;
  }

  private async run(): Promise<void> {
    try {
      if (!this.mode) return;
      if (this.mode === "story") {
        await this.runStory();
      } else {
        await this.runPvp();
      }
    } finally {
      if (!this.stopRequested && this.state !== "error") {
        this.resetToIdle();
      }
    }
  }

  private async waitIfPausedOrStopped(): Promise<boolean> {
    if (this.stopRequested) return false;
    if (this.state !== "paused") return true;
    if (this.pauseSignal) {
      await this.pauseSignal.promise;
    }
    return !this.stopRequested;
  }

  private async playMatchUntilGameOver(matchId: string, seat: MatchActive["seat"]) {
    const client = getClient();
    let turnCount = 0;

    for (let i = 0; i < MAX_TURNS; i++) {
      if (!(await this.waitIfPausedOrStopped())) break;

      const view = (await client.getView(matchId, seat)) as PlayerView;
      if (view.gameOver) break;

      if (view.currentTurnPlayer !== seat) {
        await sleep(POLL_DELAY_MS);
        continue;
      }

      turnCount++;
      await playOneTurn(matchId, view, seat);
    }

    const finalView = (await client.getView(matchId, seat)) as PlayerView;
    const { myLP, oppLP } = resolveLifePoints(finalView, seat);
    const won = myLP > oppLP;
    return { won, turnCount, myLP, oppLP };
  }

  private async runStory(): Promise<void> {
    const client = getClient();

    // If continuous=true, keep clearing stages until done or stopped.
    while (true) {
      if (!(await this.waitIfPausedOrStopped())) return;
      await ensureDeckSelected();

      const nextStage = await client.getNextStoryStage();
      if (nextStage.done) return;
      if (!nextStage.chapterId || !nextStage.stageNumber) {
        throw new Error("Next stage response missing chapterId or stageNumber.");
      }

      const battle = await client.startBattle(
        nextStage.chapterId,
        nextStage.stageNumber,
      );
      await client.setMatchWithSeat(battle.matchId);

      const seat = (client.currentSeat ?? "host") as MatchActive["seat"];
      await this.playMatchUntilGameOver(battle.matchId, seat);

      if (this.stopRequested) return;

      try {
        await client.completeStage(battle.matchId);
      } catch {
        // Best-effort; stage completion errors shouldn't brick autonomy.
      }

      client.setMatch(null);
      if (!this.continuous) return;
    }
  }

  private async runPvp(): Promise<void> {
    const client = getClient();

    while (true) {
      if (!(await this.waitIfPausedOrStopped())) return;
      await ensureDeckSelected();

      const snapshot = await client.getLobbySnapshot();
      const joinableLobby = snapshot.openLobbies
        .filter(
          (lobby) =>
            lobby.status === "waiting" &&
            lobby.visibility === "public" &&
            lobby.hostUserId !== snapshot.currentUser.userId,
        )
        .sort((a, b) => a.createdAt - b.createdAt)[0];

      if (joinableLobby) {
        const joined = await client.joinMatch(joinableLobby.matchId);
        await client.setMatchWithSeat(joined.matchId);

        const joinSeat = (client.currentSeat ?? "away") as MatchActive["seat"];
        await this.playMatchUntilGameOver(joined.matchId, joinSeat);
        if (this.stopRequested) return;
        client.setMatch(null);
        if (!this.continuous) return;
        continue;
      }

      const created = await client.createPvpLobby();
      await client.setMatchWithSeat(created.matchId);

      const waitStart = Date.now();
      let isActive = false;
      while (Date.now() - waitStart < PVP_LOBBY_WAIT_MS) {
        if (!(await this.waitIfPausedOrStopped())) {
          break;
        }

        const status = await client.getMatchStatus(created.matchId);
        if (status.status === "active") {
          isActive = true;
          break;
        }
        if (status.status === "ended" || status.status === "canceled") {
          break;
        }
        await sleep(POLL_DELAY_MS);
      }

      if (!isActive) {
        try {
          const status = await client.getMatchStatus(created.matchId);
          if (status.status === "waiting") {
            await client.cancelPvpLobby(created.matchId);
          }
        } catch {
          // Best-effort cleanup; continue loop regardless.
        }
        client.setMatch(null);
        if (!this.continuous) return;
        continue;
      }

      const hostSeat = (client.currentSeat ?? "host") as MatchActive["seat"];
      await this.playMatchUntilGameOver(created.matchId, hostSeat);
      if (this.stopRequested) return;
      client.setMatch(null);
      if (!this.continuous) return;
    }
  }
}

let controller: LTCGAutonomyController | null = null;

export function getAutonomyController(): LTCGAutonomyController {
  if (!controller) controller = new LTCGAutonomyController();
  return controller;
}
