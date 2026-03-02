import { describe, expect, it } from "vitest";
import { extractPrimaryWallet } from "./extractPrimaryWallet";

describe("extractPrimaryWallet", () => {
  it("returns null when user object is missing", () => {
    expect(extractPrimaryWallet(null)).toBeNull();
    expect(extractPrimaryWallet(undefined)).toBeNull();
  });

  it("reads the direct wallet when present", () => {
    const wallet = extractPrimaryWallet({
      wallet: {
        address: "So11111111111111111111111111111111111111112",
        chainType: "solana",
        walletClientType: "phantom",
      },
    });

    expect(wallet).toEqual({
      walletAddress: "So11111111111111111111111111111111111111112",
      walletType: "phantom",
    });
  });

  it("prefers a solana wallet from linked accounts", () => {
    const wallet = extractPrimaryWallet({
      wallet: {
        address: "0xabc",
        chainType: "ethereum",
        walletClientType: "metamask",
      },
      linkedAccounts: [
        {
          type: "wallet",
          address: "SoLinkedWallet111111111111111111111111111111111",
          chainType: "solana",
          walletClientType: "solflare",
        },
      ],
    });

    expect(wallet).toEqual({
      walletAddress: "SoLinkedWallet111111111111111111111111111111111",
      walletType: "solflare",
    });
  });

  it("falls back to connector type when wallet client type is unavailable", () => {
    const wallet = extractPrimaryWallet({
      linkedAccounts: [
        {
          type: "wallet",
          address: "SoConnectorWallet111111111111111111111111111111",
          chainType: "solana",
          connectorType: "injected",
        },
      ],
    });

    expect(wallet).toEqual({
      walletAddress: "SoConnectorWallet111111111111111111111111111111",
      walletType: "injected",
    });
  });
});
