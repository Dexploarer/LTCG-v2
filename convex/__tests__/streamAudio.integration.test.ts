/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { ALICE, seedUser, setupTestConvex } from "./setup.test-helpers";

describe("streamAudio controls", () => {
  test("returns default audio state when no row exists", async () => {
    const t = setupTestConvex();
    await seedUser(t, ALICE, api);

    const agentId = await t.run(async (ctx: any) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_privyId", (q: any) => q.eq("privyId", ALICE.subject))
        .first();
      if (!user) throw new Error("Missing seeded user");
      return ctx.db.insert("agents", {
        name: "AliceAgent",
        apiKeyHash: "hash_1",
        apiKeyPrefix: "ltcg_hash_",
        userId: user._id,
        isActive: true,
        createdAt: Date.now(),
      });
    });

    const control = await t.query(api.streamAudio.getByAgentId, { agentId });
    expect(control.playbackIntent).toBe("playing");
    expect(control.musicVolume).toBe(0.65);
    expect(control.sfxVolume).toBe(0.8);
    expect(control.musicMuted).toBe(false);
    expect(control.sfxMuted).toBe(false);
  });

  test("upsert mutation normalizes values and persists", async () => {
    const t = setupTestConvex();
    await seedUser(t, ALICE, api);

    const agentId = await t.run(async (ctx: any) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_privyId", (q: any) => q.eq("privyId", ALICE.subject))
        .first();
      if (!user) throw new Error("Missing seeded user");
      return ctx.db.insert("agents", {
        name: "AliceAgent",
        apiKeyHash: "hash_2",
        apiKeyPrefix: "ltcg_hash_",
        userId: user._id,
        isActive: true,
        createdAt: Date.now(),
      });
    });

    await t.mutation(internal.streamAudio.upsertForAgent, {
      agentId,
      playbackIntent: "paused",
      musicVolume: 150,
      sfxVolume: -0.25,
      musicMuted: true,
      sfxMuted: false,
    });

    const control = await t.query(api.streamAudio.getByAgentId, { agentId });
    expect(control.playbackIntent).toBe("paused");
    expect(control.musicVolume).toBeCloseTo(1);
    expect(control.sfxVolume).toBeCloseTo(0);
    expect(control.musicMuted).toBe(true);
    expect(control.sfxMuted).toBe(false);
  });
});
