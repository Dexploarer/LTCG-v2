import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { PRIVY_ENABLED } from "@/lib/auth/privyEnv";
import { isDiscordActivityFrame } from "@/lib/clientPlatform";

const PRIVY_APP_ID = ((import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ?? "").trim();

export function PrivyAuthProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_ENABLED) {
    return <>{children}</>;
  }

  // Discord Activities run inside a restrictive CSP sandbox (discordsays.com proxy).
  // Keep embedded wallets disabled there; use external wallets only.
  const disableEmbeddedWallets = typeof window !== "undefined" && isDiscordActivityFrame();

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Mirror Retake's wallet-first auth flow.
        loginMethods: ["wallet"],
        ...(disableEmbeddedWallets
          ? {}
          : {
              embeddedWallets: {
                solana: { createOnLogin: "off" },
              },
            }),
        appearance: {
          theme: "dark",
          accentColor: "#ffcc00",
          showWalletLoginFirst: true,
          walletChainType: "solana-only",
          walletList: ["phantom", "solflare", "backpack", "detected_solana_wallets"],
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
