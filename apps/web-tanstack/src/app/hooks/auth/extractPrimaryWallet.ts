export type PrimaryWallet = {
  walletAddress: string;
  walletType?: string;
};

type WalletCandidate = {
  walletAddress: string;
  walletType?: string;
  chainType?: string;
};

const SOLANA_CHAIN_TYPE = "solana";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toWalletCandidate(value: unknown): WalletCandidate | null {
  const obj = asObject(value);
  if (!obj) return null;

  const walletAddress = asNonEmptyString(obj.address);
  if (!walletAddress) return null;

  const chainType = asNonEmptyString(obj.chainType) ?? undefined;
  const walletType =
    asNonEmptyString(obj.walletClientType) ??
    asNonEmptyString(obj.connectorType) ??
    asNonEmptyString(obj.type) ??
    undefined;

  return {
    walletAddress,
    walletType,
    chainType,
  };
}

function pickBestCandidate(candidates: WalletCandidate[]): WalletCandidate | null {
  if (candidates.length === 0) return null;

  const preferred = candidates.find(
    (candidate) => candidate.chainType?.toLowerCase() === SOLANA_CHAIN_TYPE,
  );
  return preferred ?? candidates[0] ?? null;
}

export function extractPrimaryWallet(user: unknown): PrimaryWallet | null {
  const userObj = asObject(user);
  if (!userObj) return null;

  const candidates: WalletCandidate[] = [];

  const directWallet = toWalletCandidate(userObj.wallet);
  if (directWallet) {
    candidates.push(directWallet);
  }

  const linkedAccounts = Array.isArray(userObj.linkedAccounts)
    ? userObj.linkedAccounts
    : [];
  for (const linked of linkedAccounts) {
    const candidate = toWalletCandidate(linked);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  const best = pickBestCandidate(candidates);
  if (!best) return null;

  return {
    walletAddress: best.walletAddress,
    walletType: best.walletType,
  };
}
