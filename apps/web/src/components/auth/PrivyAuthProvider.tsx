import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string;

if (!PRIVY_APP_ID) {
  throw new Error("VITE_PRIVY_APP_ID is not set in .env.local");
}

export function PrivyAuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "telegram", "discord"],
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
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
