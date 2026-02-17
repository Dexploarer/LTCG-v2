export type Seat = "host" | "away";

export type MatchMode = "pvp" | "story";
export type MatchStatus = "waiting" | "active" | "ended";

export type MatchMeta = {
  _id: string;
  _creationTime: number;
  hostId: string;
  awayId: string | null;
  mode: MatchMode;
  status: MatchStatus;
  winner?: Seat | null;
  endReason?: string;
  hostDeck: string[];
  awayDeck?: string[] | null;
  isAIOpponent: boolean;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
};

export type StoryMatchContext = {
  matchId: string;
  chapterId: string;
  userId: string;
  stageNumber: number;
  stageId: string;
  outcome: "won" | "lost" | "abandoned" | null;
  starsEarned: number;
  rewardsGold: number;
  rewardsXp: number;
  firstClearBonus: number;
  opponentName: string;
  postMatchWinDialogue: Array<{ speaker: string; text: string; avatar?: string }>;
  postMatchLoseDialogue: Array<{ speaker: string; text: string; avatar?: string }>;
};

export type MatchEventBatch = {
  version: number;
  events: string;
  seat?: Seat;
  command?: string;
  createdAt?: number;
};

export type OpenPrompt = {
  _id: string;
  _creationTime: number;
  matchId: string;
  seat: Seat;
  promptType: "chain_response" | "optional_trigger" | "replay_decision" | "discard";
  data?: string;
  resolved: boolean;
  createdAt: number;
  resolvedAt?: number;
};

export type ParsedOpenPrompt = OpenPrompt & {
  data: unknown;
};

export type StartStoryBattleResult = {
  matchId: string;
  chapterId: string;
  stageNumber: number;
};

export type StoryCompletionResult = {
  outcome: "won" | "lost";
  starsEarned: number;
  rewards: {
    gold: number;
    xp: number;
    firstClearBonus: number;
  };
};

export type CardDefinition = {
  _id: string;
  name: string;
  cardType: string;
  type?: string;
  attack?: number;
  defense?: number;
  level?: number;
};

export type GameCardInstance = {
  cardId: string;
  definitionId: string;
  faceDown?: boolean;
  canAttack?: boolean;
  hasAttackedThisTurn?: boolean;
  turnSummoned?: number;
  temporaryBoosts?: {
    attack?: number;
  };
};

export type PlayerView = {
  currentTurnPlayer?: Seat;
  mySeat?: Seat;
  currentPhase?: "draw" | "standby" | "breakdown_check" | "main" | "main2" | "combat" | "end";
  gameOver?: boolean;
  turnNumber?: number;
  board?: GameCardInstance[];
  opponentBoard?: GameCardInstance[];
  hand?: string[];
  spellTrapZone?: Array<{ cardId: string; definitionId: string; faceDown?: boolean; } >;
  players?: {
    host?: {
      lifePoints?: number;
    };
    away?: {
      lifePoints?: number;
    };
  };
  turnPlayer?: Seat;
  lifePoints?: {
    host?: number;
    away?: number;
  };
  currentChain?: unknown[];
  gameResult?: string;
};

export type OnboardingStarterDeck = {
  name: string;
  deckCode: string;
  archetype: string;
  description: string;
  playstyle: string;
  cardCount: number;
};

export type StoryChapterStage = {
  _id: string;
  stageNumber: number;
  name?: string;
  title?: string;
  description: string;
  opponentName?: string;
  difficulty?: string;
  preMatchDialogue?: Array<{ speaker: string; text: string; avatar?: string }>;
  postMatchWinDialogue?: Array<{ speaker: string; text: string; avatar?: string }>;
  postMatchLoseDialogue?: Array<{ speaker: string; text: string; avatar?: string }>;
  rewardGold?: number;
  rewardXp?: number;
  firstClearBonus?: number;
};

export type StoryChapter = {
  _id: string;
  title: string;
  description?: string;
  chapterNumber?: number;
  actNumber?: number;
  imageUrl?: string;
  archetype?: string;
  status?: string;
};

export type StoryProgress = {
  chapterId: string;
  completed: boolean;
};

export type StageProgressEntry = {
  stageId: string;
  chapterId: string;
  stageNumber: number;
  status: string;
  starsEarned: number;
  timesCompleted: number;
  firstClearClaimed: boolean;
};

export type StoryDashboard = {
  chapters: StoryChapter[];
  chapterProgress: StoryProgress[];
  stageProgress: StageProgressEntry[];
  totalStars: number;
};

export type UserDeck = {
  deckId: string;
};

export type StarterDeck = {
  deckCode: string;
  name?: string;
};

export type StoryChapterId = string;

export type CurrentUser = {
  _id: string;
  activeDeckId?: string;
  username?: string;
  email?: string;
};

export type OnboardingStatus = {
  exists: boolean;
  hasUsername: boolean;
  hasStarterDeck: boolean;
  hasAvatar: boolean;
};

export type Clique = {
  _id: string;
  name: string;
  archetype: string;
  description: string;
  memberCount: number;
  totalWins: number;
  iconUrl?: string;
  createdAt?: number;
};

export type CliqueMember = {
  _id: string;
  username?: string;
  name?: string;
  cliqueRole?: "member" | "leader" | "founder";
  createdAt?: number;
};

export type CliqueDashboard = {
  myArchetype: string | null;
  myClique: Clique | null;
  myCliqueMembers: CliqueMember[];
  myCliqueMemberOverflow: number;
  totalPlayers: number;
  leaderboard: Array<Clique & { rank: number; isMyClique: boolean }>;
};

export type CliqueAssignmentStatusBase = { reason: string };

export type CliqueAssignmentStatus =
  | {
      status: "assigned";
      clique: Clique;
      archetype: string;
    }
  | {
      status: "already_assigned";
      clique: Clique;
      archetype: string;
    }
  | ({
      status: "missing_starter_deck";
    } & CliqueAssignmentStatusBase)
  | ({
      status: "missing_clique";
      archetype: string;
    } & CliqueAssignmentStatusBase);
