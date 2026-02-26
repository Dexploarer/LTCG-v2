/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import { seedAliceWithDeckAndStats, setupTestConvex } from "./setup.test-helpers";

describe("listPublicPvpLobbies", () => {
  test("allows unauthenticated reads", async () => {
    const t = setupTestConvex();
    const result = await t.query(api.game.listPublicPvpLobbies, { includeActive: true });
    expect(Array.isArray(result)).toBe(true);
  });

  test("returns waiting public lobbies", async () => {
    const t = setupTestConvex();
    const { asAlice } = await seedAliceWithDeckAndStats(t, api);

    await asAlice.mutation(api.game.createPvpLobby, {
      visibility: "public",
    });

    const result = await t.query(api.game.listPublicPvpLobbies, { includeActive: true });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.status).toBe("waiting");
    expect(result[0]?.visibility).toBe("public");
  });
});
