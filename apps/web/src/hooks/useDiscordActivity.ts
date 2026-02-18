import { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { isDiscordActivityFrame } from "@/lib/clientPlatform";

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

/**
 * Initializes Discord's Embedded App SDK when the app is loaded
 * as a Discord Activity iframe.
 */
export function useDiscordActivity() {
  const [isDiscordActivity] = useState<boolean>(() => isDiscordActivityFrame());
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    if (!isDiscordActivity) return;
    const rawClientId = DISCORD_CLIENT_ID;
    if (!rawClientId) {
      Sentry.captureMessage(
        "Discord Activity detected, but VITE_DISCORD_CLIENT_ID is missing.",
        "warning",
      );
      return;
    }
    const clientId: string = rawClientId;

    let cancelled = false;

    async function init() {
      try {
        const { DiscordSDK } = await import("@discord/embedded-app-sdk");
        const sdk = new DiscordSDK(clientId);
        await sdk.ready();
        if (!cancelled) setSdkReady(true);
      } catch (error) {
        Sentry.captureException(error);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [isDiscordActivity]);

  return { isDiscordActivity, sdkReady };
}
