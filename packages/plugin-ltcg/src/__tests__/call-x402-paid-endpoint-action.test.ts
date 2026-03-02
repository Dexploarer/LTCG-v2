import { beforeEach, describe, expect, it, vi } from "vitest";
import { callX402PaidEndpointAction } from "../actions/callX402PaidEndpoint.js";

const { getX402Status, callX402PaidEndpoint } = vi.hoisted(() => ({
  getX402Status: vi.fn(),
  callX402PaidEndpoint: vi.fn(),
}));

vi.mock("../x402.js", () => ({
  getX402Status,
  callX402PaidEndpoint,
  sanitizeX402Error: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

describe("callX402PaidEndpointAction", () => {
  beforeEach(() => {
    getX402Status.mockReset();
    callX402PaidEndpoint.mockReset();
  });

  it("validate returns false when x402 is disabled", async () => {
    getX402Status.mockResolvedValue({
      enabled: false,
      privateKeyConfigured: false,
    });

    const valid = await callX402PaidEndpointAction.validate(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "noop" } } as any,
      undefined,
    );

    expect(valid).toBe(false);
  });

  it("fails when no URL is provided", async () => {
    getX402Status.mockResolvedValue({
      enabled: true,
      privateKeyConfigured: true,
    });

    const result = await callX402PaidEndpointAction.handler(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "call paid endpoint" } } as any,
      undefined,
      {},
      undefined,
    );

    expect(result?.success).toBe(false);
    expect(callX402PaidEndpoint).not.toHaveBeenCalled();
  });

  it("calls paid endpoint with parsed options", async () => {
    getX402Status.mockResolvedValue({
      enabled: true,
      privateKeyConfigured: true,
    });
    callX402PaidEndpoint.mockResolvedValue({
      status: 200,
      ok: true,
      contentType: "application/json",
      bodyText: "{\"ok\":true}",
      walletAddress: "wallet_1",
      network: "mainnet",
    });

    const callback = vi.fn().mockResolvedValue([]);
    const result = await callX402PaidEndpointAction.handler(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "call https://paid.example.com/v1/usage" } } as any,
      undefined,
      {
        method: "post",
        headers: { "X-Test": "1" },
        body: { ping: "pong" },
        timeoutMs: 9000,
      },
      callback,
    );

    expect(result?.success).toBe(true);
    expect(callX402PaidEndpoint).toHaveBeenCalledWith(
      expect.any(Object),
      {
        url: "https://paid.example.com/v1/usage",
        method: "POST",
        headers: { "X-Test": "1" },
        body: { ping: "pong" },
        timeoutMs: 9000,
      },
    );
    expect(callback).toHaveBeenCalled();
  });
});
