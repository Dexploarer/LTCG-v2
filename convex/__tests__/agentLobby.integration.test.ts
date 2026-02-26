/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import {
  ALICE,
  BOB,
  seedAliceWithDeckAndStats,
  seedUser,
  setupTestConvex,
} from "./setup.test-helpers";

describe("agentLobby", () => {
  test("posts and returns recent lobby chat messages", async () => {
    const t = setupTestConvex();
    const asAlice = await seedUser(t, ALICE, api);

    await asAlice.mutation(api.agentLobby.postLobbyMessage, {
      text: "Ready for agent vs agent queue",
    });

    const snapshot = await asAlice.query(api.agentLobby.getLobbySnapshot, { limit: 20 });
    expect(snapshot.messages.length).toBe(1);
    expect(snapshot.messages[0]?.text).toBe("Ready for agent vs agent queue");
    expect(snapshot.messages[0]?.senderName).toBeDefined();
  });

  test("includes public lobbies and retake pipeline metadata", async () => {
    const t = setupTestConvex();
    const { asAlice } = await seedAliceWithDeckAndStats(t, api);
    const asBob = await seedUser(t, BOB, api);

    await asAlice.mutation(api.auth.syncUser, {
      walletAddress: "SoAliceWallet111111111111111111111111111111111111",
      walletType: "phantom",
    });
    await asAlice.mutation(api.auth.linkRetakeAccount, {
      agentId: "agt_alice",
      userDbId: "usr_alice",
      agentName: "alice_streamer",
      walletAddress: "SoAliceWallet111111111111111111111111111111111111",
      tokenAddress: "TokenAlice11111111111111111111111111111111111",
      tokenTicker: "alice",
    });
    await asAlice.mutation(api.auth.setRetakePipelineEnabled, { enabled: true });

    await asAlice.mutation(api.game.createPvpLobby, { visibility: "public" });

    const snapshot = await asBob.query(api.agentLobby.getLobbySnapshot, { limit: 20 });
    expect(snapshot.openLobbies.length).toBeGreaterThan(0);
    const lobby = snapshot.openLobbies[0]!;
    expect(lobby.visibility).toBe("public");
    expect(lobby.retake.hasRetakeAccount).toBe(true);
    expect(lobby.retake.pipelineEnabled).toBe(true);
    expect(lobby.retake.streamUrl).toContain("retake.tv");
  });

  test("supports API-key auth flow via agent-scoped snapshot/message functions", async () => {
    const t = setupTestConvex();
    const asAlice = await seedUser(t, ALICE, api);
    const asBob = await seedUser(t, BOB, api);

    const aliceUser = await t.run(async (ctx: any) =>
      ctx.db
        .query("users")
        .withIndex("by_privyId", (q: any) => q.eq("privyId", ALICE.subject))
        .first(),
    );
    const bobUser = await t.run(async (ctx: any) =>
      ctx.db
        .query("users")
        .withIndex("by_privyId", (q: any) => q.eq("privyId", BOB.subject))
        .first(),
    );

    expect(aliceUser).toBeTruthy();
    expect(bobUser).toBeTruthy();

    await asAlice.mutation(api.agentLobby.postLobbyMessageAsAgent, {
      agentUserId: aliceUser!._id,
      text: "Agent HTTP route message",
      source: "agent",
    });

    const snapshot = await asBob.query(api.agentLobby.getLobbySnapshotAsAgent, {
      agentUserId: bobUser!._id,
      limit: 20,
    });

    expect(snapshot.messages.some((entry) => entry.text === "Agent HTTP route message")).toBe(true);
  });
});
