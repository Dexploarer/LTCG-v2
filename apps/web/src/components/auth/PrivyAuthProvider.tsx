import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { isDiscordActivityFrame } from "@/lib/clientPlatform";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string;

if (!PRIVY_APP_ID) {
  throw new Error("VITE_PRIVY_APP_ID is not set in .env.local");
}

export function PrivyAuthProvider({ children }: { children: ReactNode }) {
  // Discord Activities run inside a restrictive CSP sandbox (discordsays.com proxy).
  // Privy's embedded wallet flow uses hidden iframes + external RPC hosts; disable it
  // for Activities so auth/gameplay can proceed without being blocked by frame-src/CSP.
  const disableEmbeddedWallets = typeof window !== "undefined" && isDiscordActivityFrame();

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "telegram", "discord"],
        ...(disableEmbeddedWallets
          ? {}
          : {
              embeddedWallets: {
                solana: { createOnLogin: "users-without-wallets" },
              },
            }),
        appearance: {
          theme: "dark",
          accentColor: "#ffcc00",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
