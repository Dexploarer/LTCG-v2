import { describe, expect, it } from "vitest";
import { getX402Status, sanitizeX402Error } from "../x402.js";

describe("x402 helpers", () => {
  it("reports disabled status when explicitly turned off", async () => {
    const status = await getX402Status({
      agentId: "agent_1",
      getSetting: (key: string) => {
        if (key === "LTCG_X402_ENABLED") return "false";
        return undefined;
      },
    } as any);

    expect(status.enabled).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.walletAddress).toBeNull();
  });

  it("reports missing key when enabled", async () => {
    const status = await getX402Status({
      agentId: "agent_1",
      getSetting: (key: string) => {
        if (key === "LTCG_X402_ENABLED") return "true";
        if (key === "LTCG_X402_SOLANA_PRIVATE_KEY_B58") return "   ";
        return undefined;
      },
    } as any);

    expect(status.enabled).toBe(true);
    expect(status.privateKeyConfigured).toBe(false);
    expect(status.error).toContain("LTCG_X402_SOLANA_PRIVATE_KEY_B58");
  });

  it("sanitizes unknown errors to a stable message", () => {
    expect(sanitizeX402Error(new Error("random upstream failure"))).toBe(
      "x402 paid request failed.",
    );
  });
});
