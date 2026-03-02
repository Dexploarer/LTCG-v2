import { useState, useCallback } from "react";
import { useNavigate } from "@/router/react-router";
import { useConvexAuth } from "convex/react";
import * as Sentry from "@sentry/react";
import { motion, AnimatePresence } from "framer-motion";
import { apiAny, useConvexMutation, useConvexQuery } from "@/lib/convexHelpers";
import { useUserSync } from "@/hooks/auth/useUserSync";
import { consumeRedirect } from "@/hooks/auth/usePostLoginRedirect";
import { LANDING_BG } from "@/lib/blobUrls";
import { registerAgent } from "@/lib/retake";
import {
  DEFAULT_SIGNUP_AVATAR_PATH,
  SIGNUP_AVATAR_OPTIONS,
  type SignupAvatarPath,
} from "@/lib/signupAvatarCatalog";
import { AmbientBackground } from "@/components/ui/AmbientBackground";

// ── Types ─────────────────────────────────────────────────────────

interface StarterDeck {
  name: string;
  deckCode: string;
  archetype: string;
  description: string;
  playstyle: string;
  cardCount: number;
}

type CurrentUserProfile = {
  username: string;
  walletAddress?: string;
};

const ARCHETYPE_COLORS: Record<string, string> = {
  dropouts: "#e53e3e",
  preps: "#3182ce",
  geeks: "#d69e2e",
  freaks: "#805ad5",
  nerds: "#38a169",
  goodies: "#a0aec0",
};

const ARCHETYPE_EMOJI: Record<string, string> = {
  dropouts: "\u{1F525}",
  preps: "\u{1F451}",
  geeks: "\u{1F4BB}",
  freaks: "\u{1F47B}",
  nerds: "\u{1F4DA}",
  goodies: "\u{2728}",
};

// ── Main Component ────────────────────────────────────────────────

export function Onboarding() {
  const navigate = useNavigate();
  const { onboardingStatus } = useUserSync();
  const { isAuthenticated } = useConvexAuth();

  const setUsernameMutation = useConvexMutation(apiAny.auth.setUsername);
  const setRetakeChoiceMutation = useConvexMutation(apiAny.auth.setRetakeOnboardingChoice);
  const linkRetakeAccountMutation = useConvexMutation(apiAny.auth.linkRetakeAccount);
  const setAvatarPathMutation = useConvexMutation(apiAny.auth.setAvatarPath);
  const selectStarterDeckMutation = useConvexMutation(apiAny.game.selectStarterDeck);
  const currentUser = useConvexQuery(apiAny.auth.currentUser, isAuthenticated ? {} : "skip") as
    | CurrentUserProfile
    | null
    | undefined;
  const starterDecks = useConvexQuery(apiAny.game.getStarterDecks, isAuthenticated ? {} : "skip") as
    | StarterDeck[]
    | undefined;

  // Determine which step we're on based on onboarding status
  const needsUsername = onboardingStatus && !onboardingStatus.hasUsername;
  const retakeResolved = Boolean(
    onboardingStatus?.hasRetakeChoice &&
    (!onboardingStatus.wantsRetake || onboardingStatus.hasRetakeAccount),
  );
  const needsRetake =
    onboardingStatus &&
    onboardingStatus.hasUsername &&
    !retakeResolved;
  const needsAvatar =
    onboardingStatus &&
    onboardingStatus.hasUsername &&
    retakeResolved &&
    !onboardingStatus.hasAvatar;
  const needsDeck =
    onboardingStatus &&
    onboardingStatus.hasUsername &&
    retakeResolved &&
    onboardingStatus.hasAvatar &&
    !onboardingStatus.hasStarterDeck;
  const stepCopy = needsUsername
    ? "Step 1 of 4: Choose your name"
    : needsRetake
      ? "Step 2 of 4: Link optional Retake account"
      : needsAvatar
        ? "Step 3 of 4: Pick your avatar"
        : "Step 4 of 4: Pick your deck";
  const progressWidth = needsUsername
    ? "25%"
    : needsRetake
      ? "50%"
      : needsAvatar
        ? "75%"
        : "100%";

  const handleUsernameComplete = useCallback(() => {
    // onboardingStatus will reactively update
  }, []);

  const handleAvatarComplete = useCallback(() => {
    // onboardingStatus will reactively update
  }, []);

  const handleRetakeComplete = useCallback(() => {
    // onboardingStatus will reactively update
  }, []);

  const handleDeckComplete = useCallback(() => {
    navigate(consumeRedirect() ?? "/");
  }, [navigate]);

  // Loading state
  if (!onboardingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0a09]">
        <div className="w-10 h-10 border-4 border-[#ffcc00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Already complete — redirect to saved destination or home
  if (
    onboardingStatus.hasUsername &&
    retakeResolved &&
    onboardingStatus.hasAvatar &&
    onboardingStatus.hasStarterDeck
  ) {
    navigate(consumeRedirect() ?? "/", { replace: true });
    return null;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-cover bg-center relative"
      style={{ backgroundImage: `url('${LANDING_BG}')` }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <AmbientBackground variant="dark" />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <motion.h1
            className="text-5xl md:text-6xl text-white mb-3 drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]"
            style={{ fontFamily: "Outfit, sans-serif", fontWeight: 900 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            WELCOME TO THE TABLE
          </motion.h1>
          <motion.p
            className="text-[#ffcc00] text-lg drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]"
            style={{ fontFamily: "Special Elite, cursive" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {stepCopy}
          </motion.p>
        </div>

        {/* Ink progress bar */}
        <div className="mb-6 mx-auto max-w-md">
          <div className="h-1 bg-white/20 border border-white/10">
            <motion.div
              className="h-full bg-[#ffcc00]"
              initial={{ width: "0%" }}
              animate={{ width: progressWidth }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {needsUsername && (
            <motion.div
              key="username"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <UsernameStep
                setUsernameMutation={setUsernameMutation}
                onComplete={handleUsernameComplete}
              />
            </motion.div>
          )}
          {needsRetake && (
            <motion.div
              key="retake"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <RetakeOnboardingStep
                username={currentUser?.username ?? "LunchTableAgent"}
                walletAddress={onboardingStatus?.walletAddress ?? currentUser?.walletAddress ?? null}
                setRetakeChoiceMutation={setRetakeChoiceMutation}
                linkRetakeAccountMutation={linkRetakeAccountMutation}
                onComplete={handleRetakeComplete}
              />
            </motion.div>
          )}
          {needsAvatar && (
            <motion.div
              key="avatar"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <AvatarSelectionStep
                setAvatarPathMutation={setAvatarPathMutation}
                onComplete={handleAvatarComplete}
              />
            </motion.div>
          )}
          {needsDeck && (
            <motion.div
              key="deck"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <DeckSelectionStep
                decks={starterDecks}
                selectDeckMutation={selectStarterDeckMutation}
                onComplete={handleDeckComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Step 1: Username ──────────────────────────────────────────────

function UsernameStep({
  setUsernameMutation,
  onComplete,
}: {
  setUsernameMutation: (args: { username: string }) => Promise<{ success: boolean }>;
  onComplete: () => void;
}) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      setError("3-20 characters, letters, numbers, and underscores only.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await setUsernameMutation({ username: trimmed });
      onComplete();
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err.message ?? "Failed to set username.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="paper-panel p-8 md:p-12 mx-auto max-w-md">
      <h2
        className="text-2xl mb-6 text-center"
        style={{ fontFamily: "Outfit, sans-serif", fontWeight: 900 }}
      >
        CHOOSE YOUR NAME
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="xX_Shadow_Xx"
          maxLength={20}
          className="w-full px-4 py-3 border-2 border-[#121212] bg-white text-[#121212] text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#ffcc00]"
          style={{ fontFamily: "Outfit, sans-serif" }}
          disabled={submitting}
          autoFocus
        />

        <p
          className="text-xs text-[#666] uppercase tracking-wide"
          style={{ fontFamily: "Special Elite, cursive" }}
        >
          3-20 characters. Letters, numbers, underscores.
        </p>

        {error && (
          <p className="text-red-600 text-sm font-bold uppercase">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || username.trim().length < 3}
          className="tcg-button-primary px-8 py-3 text-lg uppercase disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : "Claim Name"}
        </button>
      </form>
    </div>
  );
}

// ── Step 2: Optional Retake Link ──────────────────────────────────

function RetakeOnboardingStep({
  username,
  walletAddress,
  setRetakeChoiceMutation,
  linkRetakeAccountMutation,
  onComplete,
}: {
  username: string;
  walletAddress: string | null;
  setRetakeChoiceMutation: (args: { choice: "declined" | "accepted" }) => Promise<{
    success: boolean;
    choice: "declined" | "accepted";
  }>;
  linkRetakeAccountMutation: (args: {
    agentId: string;
    userDbId: string;
    agentName: string;
    walletAddress: string;
    tokenAddress: string;
    tokenTicker: string;
  }) => Promise<{ success: boolean; streamUrl: string }>;
  onComplete: () => void;
}) {
  const [agentName, setAgentName] = useState(() => username.replace(/\s+/g, "_").slice(0, 24));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSkip = async () => {
    setSubmitting(true);
    setError("");
    try {
      await setRetakeChoiceMutation({ choice: "declined" });
      onComplete();
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err.message ?? "Failed to skip Retake setup.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!walletAddress) {
      setError("No wallet found. Sign in again with Phantom, Solflare, or Backpack.");
      return;
    }
    const normalizedName = agentName.trim().replace(/\s+/g, "_");
    if (normalizedName.length < 3) {
      setError("Retake name must be at least 3 characters.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const imageUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/favicon.ico`
          : "https://lunchtable.app/favicon.ico";
      const registration = await registerAgent({
        agent_name: normalizedName,
        agent_description: `LunchTable agent streamer for ${username}.`,
        image_url: imageUrl,
        wallet_address: walletAddress,
      });

      if (!registration) {
        throw new Error("Retake registration failed. Please try again.");
      }

      await linkRetakeAccountMutation({
        agentId: registration.agent_id,
        userDbId: registration.userDbId,
        agentName: registration.agent_name,
        walletAddress: registration.wallet_address,
        tokenAddress: registration.token_address,
        tokenTicker: registration.token_ticker,
      });
      onComplete();
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err.message ?? "Failed to link Retake account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="paper-panel p-8 md:p-10 mx-auto max-w-2xl">
      <h2
        className="text-2xl mb-3 text-center"
        style={{ fontFamily: "Outfit, sans-serif", fontWeight: 900 }}
      >
        RETAKE PIPELINE (OPTIONAL)
      </h2>
      <p
        className="text-sm text-[#444] mb-5 text-center"
        style={{ fontFamily: "Special Elite, cursive" }}
      >
        Use your same wallet to create a Retake identity, stream matches, and keep overlay integrity end-to-end.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider font-black text-[#121212]">
            Wallet
          </label>
          <input
            type="text"
            value={walletAddress ?? "Not detected"}
            readOnly
            className="mt-1 w-full border-2 border-[#121212] bg-[#f8f8f8] px-3 py-2 text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider font-black text-[#121212]">
            Retake Agent Name
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
            className="mt-1 w-full border-2 border-[#121212] bg-white px-3 py-2 text-sm font-bold"
            maxLength={32}
            disabled={submitting}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-red-600 text-sm font-bold uppercase">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={submitting}
          className="tcg-button-primary px-6 py-3 text-sm uppercase disabled:opacity-50"
        >
          {submitting ? "Linking..." : "Yes, Link Retake"}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={submitting}
          className="tcg-button px-6 py-3 text-sm uppercase disabled:opacity-50"
        >
          Skip For Now
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Avatar Selection ──────────────────────────────────────

function AvatarSelectionStep({
  setAvatarPathMutation,
  onComplete,
}: {
  setAvatarPathMutation: (args: { avatarPath: string }) => Promise<{ success: boolean; avatarPath: string }>;
  onComplete: () => void;
}) {
  const [selectedAvatarPath, setSelectedAvatarPath] =
    useState<SignupAvatarPath>(DEFAULT_SIGNUP_AVATAR_PATH);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    setSubmitting(true);
    setError("");
    try {
      await setAvatarPathMutation({ avatarPath: selectedAvatarPath });
      onComplete();
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err.message ?? "Failed to save avatar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="paper-panel p-6 md:p-8 mx-auto max-w-5xl">
      <h2
        className="text-2xl md:text-3xl mb-6 text-center"
        style={{ fontFamily: "Outfit, sans-serif", fontWeight: 900 }}
      >
        PICK YOUR PROFILE AVATAR
      </h2>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4 max-h-[56vh] overflow-y-auto p-1 mb-6">
        {SIGNUP_AVATAR_OPTIONS.map((avatar) => {
          const selected = selectedAvatarPath === avatar.path;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => setSelectedAvatarPath(avatar.path)}
              className={`relative border-[3px] transition-all hover:rotate-1 ${
                selected
                  ? "border-[#ffcc00] ring-3 ring-[#ffcc00]/70 scale-[1.03]"
                  : "border-[#121212] hover:border-[#ffcc00] hover:scale-[1.02]"
              }`}
              style={{
                boxShadow: selected
                  ? "6px 6px 0px 0px rgba(255,204,0,0.8)"
                  : "4px 4px 0px 0px rgba(18,18,18,1)",
                transition: "transform 0.2s ease",
              }}
              aria-label={`Choose ${avatar.id}`}
            >
              <img
                src={avatar.url}
                alt={avatar.id}
                className="w-full aspect-[3/4] object-cover bg-[#101010]"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-red-600 text-sm font-bold uppercase text-center mb-4">{error}</p>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={handleContinue}
          disabled={submitting}
          className="tcg-button-primary px-10 py-4 text-xl uppercase disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving avatar..." : "Continue"}
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Deck Selection ────────────────────────────────────────

interface DeckSelectionStepProps {
  decks: StarterDeck[] | undefined;
  selectDeckMutation: (args: { deckCode: string }) => Promise<{ deckId: string; cardCount: number }>;
  onComplete: () => void;
}

function DeckSelectionStep({
  decks,
  selectDeckMutation,
  onComplete,
}: DeckSelectionStepProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!selected) return;

    setSubmitting(true);
    setError("");

    try {
      await selectDeckMutation({ deckCode: selected });
      onComplete();
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err.message ?? "Failed to select deck.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!decks) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-[#ffcc00] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div>
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      >
        {decks.map((deck) => {
          const color = ARCHETYPE_COLORS[deck.archetype] ?? "#666";
          const emoji = ARCHETYPE_EMOJI[deck.archetype] ?? "\u{1F0CF}";
          const isSelected = selected === deck.deckCode;

          return (
            <motion.button
              key={deck.deckCode}
              type="button"
              onClick={() => setSelected(deck.deckCode)}
              variants={{
                hidden: { opacity: 0, y: 16, scale: 0.95 },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { type: "spring", stiffness: 300, damping: 24 },
                },
              }}
              whileHover={{ y: -4, boxShadow: "8px 8px 0px 0px rgba(18,18,18,1)" }}
              className={`
                paper-panel p-5 text-left cursor-pointer
                ${isSelected ? "ring-4 ring-[#ffcc00] -translate-y-1" : ""}
              `}
              style={{
                borderColor: isSelected ? color : "#121212",
                boxShadow: isSelected
                  ? `6px 6px 0px 0px ${color}`
                  : "4px 4px 0px 0px rgba(18,18,18,1)",
              }}
            >
              <div className="text-3xl mb-2">{emoji}</div>
              <h3
                className="text-lg leading-tight mb-1"
                style={{
                  fontFamily: "Outfit, sans-serif",
                  fontWeight: 900,
                  color,
                }}
              >
                {deck.name}
              </h3>
              <p
                className="text-xs text-[#666] mb-2 uppercase tracking-wide"
                style={{ fontFamily: "Special Elite, cursive" }}
              >
                {deck.playstyle}
              </p>
              <p className="text-xs text-[#444] leading-snug">{deck.description}</p>
              <p className="text-[10px] text-[#999] mt-2 uppercase">{deck.cardCount} cards</p>
            </motion.button>
          );
        })}
      </motion.div>

      {error && (
        <p className="text-red-600 text-sm font-bold uppercase text-center mb-4">{error}</p>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selected || submitting}
          className="tcg-button-primary px-10 py-4 text-xl uppercase disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Building deck..." : "Choose This Deck"}
        </button>
        <p
          className="text-xs text-[#666] uppercase tracking-wide mt-3"
          style={{ fontFamily: "Special Elite, cursive" }}
        >
          Clique assignment happens automatically from this starter deck.
        </p>
      </div>
    </div>
  );
}
