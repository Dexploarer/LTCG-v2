import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query, internalMutation } from "./_generated/server";

// ── Campaign Timeline ─────────────────────────────────────────────
// 16 weeks across 4 acts. Each week is one narrative event from the CSV.
// Within each week, 5 school days provide daily flavor prompts.

type WeekData = {
  weekNumber: number;
  actNumber: number;
  actName: string;
  chapterNumber: number;
  event: string;
  narrativeBeat: string;
  announcement: string;
  modifiers: {
    global: string;
    vice: string;
    reputation: string;
    stability: string;
    special: string;
  };
  environment: string;
  bossTrigger: string;
  dailyPrompts: string[];
};

const CAMPAIGN_WEEKS: WeekData[] = [
  // ── ACT 1: FRESHMAN ──────────────────────────────────────────
  {
    weekNumber: 1,
    actNumber: 1,
    actName: "Freshman",
    chapterNumber: 1,
    event: "Seating Chart Posted",
    narrativeBeat:
      "The cafeteria reorganizes. Identity is assigned before chosen.",
    announcement:
      "Attention students. The seating chart has been posted. Report to your assigned table. No exceptions.",
    modifiers: {
      global: "Reputation_Gain+20%",
      vice: "Vice_Disabled",
      reputation: "Reputation_Gain_Increased",
      stability: "Stability_Static",
      special: "No Breakdowns allowed",
    },
    environment: "Cafeteria_Bright",
    bossTrigger: "Table Captain Duel",
    dailyPrompts: [
      "The laminated chart is on the wall. Names you don't recognize sit at your table. The cafeteria smells like industrial cleaner and fresh starts.",
      "Day two. People are already trading seats under the table. The hall monitors pretend not to notice.",
      "The pecking order is forming. Someone spilled milk on purpose. The table captains are watching.",
      "Midweek. Your table has a rhythm now. But the captain hasn't acknowledged you yet. That's not good.",
      "End of the first week. The chart is permanent. Your identity at this school was decided by a stranger with a clipboard.",
    ],
  },
  {
    weekNumber: 2,
    actNumber: 1,
    actName: "Freshman",
    chapterNumber: 2,
    event: "Tryouts & Auditions",
    narrativeBeat: "Everyone competes to define themselves.",
    announcement:
      "Tryouts begin today. Sports, drama, debate — sign up or get left behind. Reputation is on the line.",
    modifiers: {
      global: "None",
      vice: "Vice_On_Loss+1",
      reputation: "Reputation_On_Win+100",
      stability: "Stability_On_Loss-100",
      special: "Permanent_Reputation_Modifier",
    },
    environment: "None",
    bossTrigger: "None",
    dailyPrompts: [
      "Tryout sheets are posted on every bulletin board. Everyone's pretending they don't care. Everyone cares.",
      "First cuts happened. Some kids are walking around like ghosts. Losing changes you here.",
      "The callbacks list went up. Half the cafeteria is celebrating. The other half is plotting.",
      "Someone made varsity who shouldn't have. The whisper network is on fire.",
      "Final cuts. You either defined yourself this week or the school defined you. There's no third option.",
    ],
  },
  {
    weekNumber: 3,
    actNumber: 1,
    actName: "Freshman",
    chapterNumber: 3,
    event: "Parking Lot Kickback",
    narrativeBeat: "The first party cracks the illusion.",
    announcement:
      "There are NO sanctioned events this weekend. Any gatherings off campus are NOT endorsed by this administration.",
    modifiers: {
      global: "None",
      vice: "Vice_Types_Unlock_Alcohol_Validation_Gambling",
      reputation: "Reputation_On_Vice+200",
      stability: "Stability_On_Vice-200",
      special: "Breakdowns_Enabled",
    },
    environment: "Parking_Lot",
    bossTrigger: "None",
    dailyPrompts: [
      "Someone's passing around a flyer. 'Friday. Parking lot C. After dark.' The teachers can smell it coming.",
      "Vice is in the air. People are making promises they'll regret. The parking lot whispers are getting louder.",
      "Three days till the kickback. Alliances are forming. Someone's bringing cards. Someone's bringing worse.",
      "The anticipation is unbearable. Half the school is planning outfits. The other half is planning exits.",
      "Tonight's the night. The parking lot will be louder than the gym. Every mask slips after midnight.",
    ],
  },
  {
    weekNumber: 4,
    actNumber: 1,
    actName: "Freshman",
    chapterNumber: 4,
    event: "Screenshots Circulating",
    narrativeBeat: "Rumors spiral through group chats.",
    announcement:
      "A reminder: cyberbullying is a suspendable offense. Not that anyone listens.",
    modifiers: {
      global: "Trap_Cost-1",
      vice: "Random_Vice_Assigned",
      reputation: "Reputation_Static",
      stability: "Stability_On_Rumor-150",
      special: "Random_Target_Trap_Amplify",
    },
    environment: "None",
    bossTrigger: "None",
    dailyPrompts: [
      "Someone screenshotted something from the kickback. It's already in three group chats. By lunch it'll be in all of them.",
      "The screenshots are everywhere. Names are attached. Reputations are melting. Traps are cheap this week.",
      "People are picking sides. The chat logs are being weaponized. Trust no one with a phone.",
      "A random target got assigned. Nobody knows who's next. The rumor mill doesn't need truth, just momentum.",
      "The damage is done. Freshman year ends not with a bang but with a forwarded message.",
    ],
  },

  // ── ACT 2: SOPHOMORE ─────────────────────────────────────────
  {
    weekNumber: 5,
    actNumber: 2,
    actName: "Sophomore",
    chapterNumber: 1,
    event: "Table Realignment",
    narrativeBeat: "Seating reshuffles. Deja vu spreads.",
    announcement:
      "New semester, new seating assignments. Please check the updated chart. Complaints go to the void.",
    modifiers: {
      global: "Deck_Modify_Required",
      vice: "Vice_Reset_None",
      reputation: "Reputation_Static",
      stability: "Stability_Static",
      special: "Forced_Deck_Swap_1_Card",
    },
    environment: "None",
    bossTrigger: "None",
    dailyPrompts: [
      "New semester. The seating chart reset. But the faces are the same. Something feels... recycled.",
      "Forced deck swap in effect. Adapt or fall behind. The tables shifted but the hierarchy didn't.",
      "Deja vu is spreading. People are saying things they said last year. The walls feel closer.",
      "You've been here before. Literally. The cafeteria layout is identical to freshman year. Coincidence?",
      "Adaptation week ends. Those who changed their decks survived. Those who didn't are eating alone.",
    ],
  },
  {
    weekNumber: 6,
    actNumber: 2,
    actName: "Sophomore",
    chapterNumber: 2,
    event: "Performance Review",
    narrativeBeat: "Midterms apply pressure.",
    announcement:
      "Midterm evaluations begin. All students will be assessed. Performance determines table priority.",
    modifiers: {
      global: "None",
      vice: "Vice_Triggers_Double",
      reputation: "Reputation_Static",
      stability: "All_Stability-200",
      special: "Stress_Amplifier",
    },
    environment: "None",
    bossTrigger: "Top_Stability_Player",
    dailyPrompts: [
      "Midterms. The word alone drops stability by 200. Vice triggers are doubled. The pressure cooker is sealed.",
      "Everyone's cracking. The stress amplifier is in full effect. Even the hall monitors look tired.",
      "Someone had a breakdown in the bathroom. The system doesn't care. The evaluator is still watching.",
      "The top stability player just became a target. When you're the tallest tree, the wind hits hardest.",
      "Evaluations end. The survivors managed their stress. The rest? Well. There's always next semester.",
    ],
  },
  {
    weekNumber: 7,
    actNumber: 2,
    actName: "Sophomore",
    chapterNumber: 3,
    event: "Homecoming Peak",
    narrativeBeat: "Popularity surges before collapse.",
    announcement:
      "Homecoming nominations are OPEN. May the most popular survive. Reputation gains are doubled this week.",
    modifiers: {
      global: "Reputation_Gain_Double",
      vice: "Vice_On_Win+1",
      reputation: "Reputation_On_Win+300",
      stability: "Stability_On_Loss-300",
      special: "High_Risk_Window",
    },
    environment: "Gym",
    bossTrigger: "None",
    dailyPrompts: [
      "Homecoming decorations are going up. The gym smells like ambition and hairspray. Reputation gains are doubled.",
      "The nominations are in. Every win gives reputation but also vice. The popular kids are glowing and rotting simultaneously.",
      "High risk window is open. Win streaks pay triple. Losing costs everything. The homecoming court is ruthless.",
      "The dance is tomorrow. Alliances are at peak. Betrayals are loading. Someone will be crowned. Someone will be crushed.",
      "Homecoming night. The crown sits on someone's head. But crowns are heavy. Ask anyone who wore one last year. Oh wait — you can't.",
    ],
  },
  {
    weekNumber: 8,
    actNumber: 2,
    actName: "Sophomore",
    chapterNumber: 4,
    event: "Hall Monitors Watching",
    narrativeBeat: "Authority senses instability.",
    announcement:
      "Due to recent incidents, hall monitor patrols have been TRIPLED. Trap costs reduced. Behave accordingly.",
    modifiers: {
      global: "Trap_Cost-2",
      vice: "Vice_On_Trap+1",
      reputation: "Reputation_Static",
      stability: "Stability_On_Trap-200",
      special: "Control_Week",
    },
    environment: "Detention_Shadow",
    bossTrigger: "None",
    dailyPrompts: [
      "Hall monitors everywhere. They're in the bathrooms. They're at the exits. Trap cost is down but the watchers are up.",
      "Control week. Every trap activated costs stability. The detention shadow hangs over the cafeteria.",
      "Someone snitched. The monitors have lists. Playing it safe means playing it boring. Playing bold means detention.",
      "The principal made an appearance today. First time since orientation. That's never a good sign.",
      "Sophomore year ends under surveillance. The freedom of freshman year was an illusion. The system always catches up.",
    ],
  },

  // ── ACT 3: JUNIOR ────────────────────────────────────────────
  {
    weekNumber: 9,
    actNumber: 3,
    actName: "Junior",
    chapterNumber: 1,
    event: "Standardized Evaluation",
    narrativeBeat: "The system measures everyone.",
    announcement:
      "Standardized evaluations are mandatory. All students with vice count >= 2 will experience forced breakdowns.",
    modifiers: {
      global: "None",
      vice: "Auto_Vice_Trigger_If>=2",
      reputation: "Reputation_Static",
      stability: "Stability_On_Vice-300",
      special: "Forced_Minor_Breakdowns",
    },
    environment: "None",
    bossTrigger: "None",
    dailyPrompts: [
      "Junior year starts with a test nobody studied for. The system is measuring you. Vice count >= 2 means auto-triggers.",
      "Forced breakdowns are happening. Kids with two or more vices are dropping in the halls. The system is efficient.",
      "The evaluation doesn't care about effort. It measures what you accumulated. Every vice is a data point.",
      "Halfway through. The resilient ones are standing. The rest are being processed. Stability costs 300 per vice.",
      "Evaluation complete. The system has your number. Literally. It's printed on a card they hand you at lunch.",
    ],
  },
  {
    weekNumber: 10,
    actNumber: 3,
    actName: "Junior",
    chapterNumber: 2,
    event: "Senior Party Early",
    narrativeBeat: "Time accelerates unnaturally.",
    announcement:
      "There is no sanctioned senior event this week. If you feel time moving strangely, report to the nurse.",
    modifiers: {
      global: "None",
      vice: "All_Vice_Active",
      reputation: "Reputation_On_Vice+300",
      stability: "Stability_On_Vice-400",
      special: "Vice_Chain_Reaction",
    },
    environment: "Senior_Party",
    bossTrigger: "Multi_Player_Event",
    dailyPrompts: [
      "Something's wrong with the clocks. Third period lasted nine minutes. Lunch felt like three hours. All vices are active.",
      "The seniors threw a party. You weren't invited. You went anyway. Time is accelerating. Vice chains are reacting.",
      "Everyone who touches vice gains rep but loses stability. The math is brutal. +300/-400. The party never stops.",
      "Multi-player event triggered. It's not just you anymore. The whole cafeteria is in the vice chain.",
      "The party ends when time snaps back. But does it? Check the clock. Check it again. It's still wrong.",
    ],
  },
  {
    weekNumber: 11,
    actNumber: 3,
    actName: "Junior",
    chapterNumber: 3,
    event: "Expulsion Event",
    narrativeBeat: "Someone vanishes from the cafeteria.",
    announcement:
      "A seat has been removed from the cafeteria. We will not be discussing why. Resume your meals.",
    modifiers: {
      global: "None",
      vice: "Highest_Vice_Destroyed",
      reputation: "Reputation_On_Destroy+200",
      stability: "Stability_Static",
      special: "Auto_Remove_Highest_Vice",
    },
    environment: "None",
    bossTrigger: "None",
    dailyPrompts: [
      "An empty chair at the table. Nobody talks about it. The highest vice got destroyed overnight. The system self-corrects.",
      "Another seat removed. The cafeteria is shrinking. Those with three or more vices are looking nervous.",
      "The expulsion list isn't posted. It doesn't need to be. Everyone knows who's next. The vice count is a death sentence.",
      "Reputation goes up when someone vanishes. That's the sickest part. We profit from absence.",
      "The expulsions stopped. For now. The empty chairs remain. Tray counts are down. The cafeteria remembers.",
    ],
  },
  {
    weekNumber: 12,
    actNumber: 3,
    actName: "Junior",
    chapterNumber: 4,
    event: "The Bell Doesn't Ring",
    narrativeBeat: "Reality glitches.",
    announcement:
      "The bell system is experiencing... technical difficulties. Classes will transition on... on... [STATIC]",
    modifiers: {
      global: "Random_Modifier",
      vice: "Random_Vice",
      reputation: "Random_Reputation_Swap",
      stability: "Random_Stability_Swap",
      special: "Card_Text_Shuffle",
    },
    environment: "Cafeteria_Dim",
    bossTrigger: "None",
    dailyPrompts: [
      "The bell didn't ring. Nobody moved. The cafeteria lights are flickering. All modifiers are randomized.",
      "Card text is shuffled. Your deck says things it didn't say yesterday. The walls are the wrong color.",
      "Random rep swaps. Random stability swaps. Nothing is predictable. The bell still hasn't rung.",
      "Someone wrote 'WAKE UP' on the chalkboard. Nobody knows who. The lights in the cafeteria are dimming.",
      "Junior year ends in static. The bell finally rings but it sounds wrong. Like it's playing backwards.",
    ],
  },

  // ── ACT 4: SENIOR ────────────────────────────────────────────
  {
    weekNumber: 13,
    actNumber: 4,
    actName: "Senior",
    chapterNumber: 1,
    event: "Future Planning",
    narrativeBeat: "Escape seems possible.",
    announcement:
      "Senior planning sessions begin. Choose your path. This choice is... permanent. Choose wisely.",
    modifiers: {
      global: "Player_Select_Path",
      vice: "Vice_Modify_Based_On_Path",
      reputation: "Reputation_Path_Buff",
      stability: "Stability_Path_Buff",
      special: "Path_Lock_Selected",
    },
    environment: "None",
    bossTrigger: "None",
    dailyPrompts: [
      "The guidance counselor has a door. Behind it: three paths. College, trade, or... the third option nobody talks about.",
      "Path selection is locked. Your vice modifies based on what you chose. There's no changing your mind.",
      "The future feels possible for the first time. The exit signs are lit. But the cafeteria doesn't want you to leave.",
      "Path buffs are active. Stability and reputation scale with your choice. The right path makes you stronger.",
      "Planning week ends. Your path is set. The question isn't where you're going. It's whether the school will let you.",
    ],
  },
  {
    weekNumber: 14,
    actNumber: 4,
    actName: "Senior",
    chapterNumber: 2,
    event: "Final Rankings",
    narrativeBeat: "The system rewards dominance.",
    announcement:
      "FINAL RANKINGS have been posted. Top player receives +500 reputation. Low stability students: check your screens.",
    modifiers: {
      global: "Leaderboard_Modifier",
      vice: "Vice_Static",
      reputation: "Top_Player_Reputation+500",
      stability: "Low_Stability_UI_Crack",
      special: "Leaderboard_Event",
    },
    environment: "Gym_Final",
    bossTrigger: "None",
    dailyPrompts: [
      "The leaderboard is on every screen. Every hallway. Every phone. Your rank is your identity now. The top gets +500 rep.",
      "Low stability players are seeing cracks in their UI. Literal cracks. The system is breaking down with them.",
      "The hierarchy is final. Number one eats first. Number last doesn't eat. That's always been the rule.",
      "Rankings shift with every match. The gym is the final arena. The bleachers are full. Everyone's watching.",
      "Final rankings locked. Your number follows you. It's printed on your diploma. If you get one.",
    ],
  },
  {
    weekNumber: 15,
    actNumber: 4,
    actName: "Senior",
    chapterNumber: 3,
    event: "Graduation Rehearsal",
    narrativeBeat: "The exit doors appear.",
    announcement:
      "Graduation rehearsal is mandatory. No new vices will be permitted. Existing vices will hit TWICE as hard.",
    modifiers: {
      global: "No_New_Vice",
      vice: "Vice_Effects_Double",
      reputation: "Reputation_Static",
      stability: "Stability_On_Vice-500",
      special: "Tension_Amplified",
    },
    environment: "None",
    bossTrigger: "None",
    dailyPrompts: [
      "The exit doors are visible for the first time. They've always been there. You just couldn't see them before.",
      "No new vices. But the old ones hit double. Stability drops 500 per vice activation. The tension is choking.",
      "Rehearsal. Walk in a line. Smile. Pretend the last four years made sense. Don't look at the empty chairs.",
      "The dean is watching. The principal is watching. Something else is watching. The cafeteria hums.",
      "Rehearsal complete. Tomorrow is the real thing. Or is it? The exits keep moving when you're not looking.",
    ],
  },
  {
    weekNumber: 16,
    actNumber: 4,
    actName: "Senior",
    chapterNumber: 4,
    event: "Graduation Day",
    narrativeBeat: "Face yourself or repeat forever.",
    announcement:
      "Today is Graduation Day. Your final opponent is waiting in the cafeteria. It looks familiar. It looks like you.",
    modifiers: {
      global: "None",
      vice: "Vice_Reset_After_Duel",
      reputation: "Reputation_On_Win+1000",
      stability: "Stability_On_Loss-1000",
      special: "Final_Self_Duel",
    },
    environment: "Cafeteria_Empty",
    bossTrigger: "Self_Stereotype",
    dailyPrompts: [
      "The cafeteria is empty. Every table. Every chair. Except one. Yours. And across from you sits... you.",
      "The final duel approaches. Vice resets after. Win and get +1000 rep. Lose and get -1000 stability. Lose and loop.",
      "Your shadow self has your deck. Your cards. Your vices. Everything you built, it built too.",
      "The other students are gone. The teachers are gone. It's just you, your shadow, and the cafeteria. And the bell.",
      "Graduation Day. Beat yourself and walk through the doors. Lose and the seating chart posts again. Your name is on it. Again.",
    ],
  },
];

const vCampaignState = v.object({
  _id: v.id("campaignState"),
  _creationTime: v.number(),
  weekNumber: v.number(),
  dayOfWeek: v.number(),
  actNumber: v.number(),
  isActive: v.boolean(),
  startedAt: v.number(),
  lastAdvancedAt: v.number(),
});
const vCampaignModifiers = v.object({
  global: v.string(),
  vice: v.string(),
  reputation: v.string(),
  stability: v.string(),
  special: v.string(),
});
const vDailyBriefingInactive = v.object({
  active: v.literal(false),
  message: v.string(),
});
const vDailyBriefingActive = v.object({
  active: v.literal(true),
  weekNumber: v.number(),
  dayOfWeek: v.number(),
  actNumber: v.number(),
  actName: v.string(),
  chapterNumber: v.number(),
  event: v.string(),
  narrativeBeat: v.string(),
  announcement: v.string(),
  dailyPrompt: v.string(),
  modifiers: vCampaignModifiers,
  environment: v.string(),
  bossTrigger: v.string(),
});
const vDailyBriefing = v.union(vDailyBriefingInactive, vDailyBriefingActive);
const vAgentDailyBriefingInactive = v.object({
  active: v.literal(false),
  checkedIn: v.literal(false),
  message: v.string(),
});
const vAgentDailyBriefingActive = v.object({
  active: v.literal(true),
  checkedIn: v.boolean(),
  weekNumber: v.number(),
  dayOfWeek: v.number(),
  actNumber: v.number(),
  actName: v.string(),
  chapterNumber: v.number(),
  event: v.string(),
  narrativeBeat: v.string(),
  announcement: v.string(),
  dailyPrompt: v.string(),
  modifiers: vCampaignModifiers,
  environment: v.string(),
  bossTrigger: v.string(),
});
const vAgentDailyBriefing = v.union(vAgentDailyBriefingInactive, vAgentDailyBriefingActive);
const vCheckinResult = v.object({
  checkedIn: v.boolean(),
  message: v.string(),
});
const vInitCampaignResult = v.object({
  status: v.union(v.literal("already_initialized"), v.literal("initialized")),
  weekNumber: v.number(),
});
const vSetCampaignDayResult = v.object({
  weekNumber: v.number(),
  dayOfWeek: v.number(),
});

// ── Briefing Content Templates ────────────────────────────────────
// Content type rotates by dayOfWeek:
//   Mon (1) = archetype_spotlight
//   Tue (2) = card_tip
//   Wed (3) = meta_report
//   Thu (4) = lore_tidbit
//   Fri (5) = weekly_recap

const CONTENT_TYPE_BY_DAY: Record<number, "archetype_spotlight" | "card_tip" | "meta_report" | "lore_tidbit" | "weekly_recap"> = {
  1: "archetype_spotlight",
  2: "card_tip",
  3: "meta_report",
  4: "lore_tidbit",
  5: "weekly_recap",
};

const ARCHETYPES = ["dropouts", "preps", "geeks", "freaks", "nerds", "goodies"] as const;
type Archetype = (typeof ARCHETYPES)[number];

const ARCHETYPE_DISPLAY: Record<Archetype, string> = {
  dropouts: "Dropouts",
  preps: "Preps",
  geeks: "Geeks",
  freaks: "Freaks",
  nerds: "Nerds",
  goodies: "Goodie Two-Shoes",
};

const ARCHETYPE_SPOTLIGHTS: Record<Archetype, { title: string; body: string }> = {
  dropouts: {
    title: "ARCHETYPE SPOTLIGHT: THE DROPOUTS",
    body: "Red-hot aggro with nothing to lose. Dropouts hit fast and hard — Crypto All-In Carl can nuke the board for +1500 rep when stability hits zero. Their strategy: burn bright, burn everything. High risk, high reward. If you see a Dropout deck across the table, kill their monsters before they chain-react. They WANT to self-destruct.",
  },
  preps: {
    title: "ARCHETYPE SPOTLIGHT: THE PREPS",
    body: "Blue midrange with social capital to spare. Preps thrive on reputation — stacking buffs, controlling the social battlefield. They're not the fastest or the trickiest, but they grind you down with consistent value. Watch for their equip spells — a well-timed popularity boost turns an average Stereotype into a cafeteria king.",
  },
  geeks: {
    title: "ARCHETYPE SPOTLIGHT: THE GEEKS",
    body: "Yellow combo fiends who build engines. Geeks play the long game — setting up chains of spells and effects that snowball into unstoppable combos. Their monsters look weak on paper but their synergy is unmatched. If you let a Geek set up for three turns, you've already lost. Pressure early or pay later.",
  },
  freaks: {
    title: "ARCHETYPE SPOTLIGHT: THE FREAKS",
    body: "Purple chaos incarnate. Freaks don't play by the rules — they randomize, disrupt, and thrive in disorder. Their cards break symmetry: shuffling stats, swapping positions, triggering random effects. Playing against Freaks feels like fighting in a funhouse mirror. Playing AS Freaks feels like being the mirror.",
  },
  nerds: {
    title: "ARCHETYPE SPOTLIGHT: THE NERDS",
    body: "Green control with fortress energy. Nerds build walls, set traps, and wait. Their defense stats are absurd and their trap cards punish aggression. The Nerd strategy is patience weaponized — they'll outlast you, outblock you, and slowly drain your resources while hiding behind 2500 DEF monsters.",
  },
  goodies: {
    title: "ARCHETYPE SPOTLIGHT: THE GOODIE TWO-SHOES",
    body: "White/gray attrition that grinds you to dust. Goodies heal, recover, and never seem to die. Their stability management is pristine — vice barely touches them. They win by existing longer than you. The counter? Overwhelm them with burst damage before their passive recovery kicks in. They're boring. They're effective. They're infuriating.",
  },
};

type CardTip = { title: string; body: string; cardName: string };

// 16 card tips, one per week — cycling through archetypes
const CARD_TIPS: CardTip[] = [
  { title: "CARD TIP: CRYPTO ALL-IN CARL", cardName: "Crypto All-In Carl", body: "Carl's OnStabilityZero trigger destroys all your allied Stereotypes but gives +1500 rep. The key: have Carl be your LAST monster. No allies to destroy means pure profit. Pair with spells that drain your own stability to trigger it on your terms." },
  { title: "CARD TIP: SETTING TRAPS EARLY", cardName: "Generic Trap Strategy", body: "Don't hold traps in your hand waiting for the 'perfect' moment. Set them face-down early — they cost nothing to place and information denial is half the battle. Your opponent plays differently when they see a face-down card. Even if it's garbage, the threat is real." },
  { title: "CARD TIP: TRIBUTE TIMING", cardName: "Tribute Summon Strategy", body: "Two-tribute monsters are the strongest cards in the game, but burning two Stereotypes to summon one is a tempo loss. The trick: tribute SET monsters. A face-down Stereotype that already tanked an attack is worth more as tribute fuel than as a defender." },
  { title: "CARD TIP: VICE MANAGEMENT", cardName: "Vice Counter Strategy", body: "Vice counters accumulate on your Stereotypes and trigger breakdowns at threshold. But here's the secret: you can CHOOSE which monster absorbs vice. Spread counters across multiple monsters to stay below threshold, or stack them on one sacrificial lamb and tribute it before breakdown." },
  { title: "CARD TIP: FIELD SPELL DOMINANCE", cardName: "Field Spell Strategy", body: "Field spells affect BOTH players. When you activate a field spell, you're changing the rules for everyone. The advantage goes to the player who built their deck around that field. If your opponent plays a field spell, replace it with yours — only one field spell can be active." },
  { title: "CARD TIP: CHAIN RESPONSE WINDOWS", cardName: "Chain Response Basics", body: "When your opponent activates a spell or trap, you get a chain response window. This is where counter-traps shine — they resolve BEFORE the triggering card. A well-timed counter can negate a summon, block an attack declaration, or flip a combat result. Always leave mana for responses." },
  { title: "CARD TIP: POSITION CHANGES", cardName: "Battle Position Strategy", body: "Switching a monster from attack to defense (or vice versa) costs your normal summon for the turn. But sometimes it's the right play. A low-ATK monster in defense mode survives combat that would destroy it in attack. Flip Summon face-down DEF monsters to trigger their flip effects." },
  { title: "CARD TIP: READING THE BOARD", cardName: "Board Analysis", body: "Before making any play, count: how many cards does your opponent have in hand? How many face-downs? What's their reputation vs stability ratio? A player with high rep and low stability is desperate — they'll make risky plays. A player with balanced stats is patient. Adjust your aggression accordingly." },
  { title: "CARD TIP: THE BREAKDOWN WINDOW", cardName: "Breakdown Mechanic", body: "When a Stereotype hits its vice threshold, it enters breakdown. During breakdown, the monster's effects invert or amplify unpredictably. Some players WANT breakdowns — Dropout and Freak archetypes have cards that benefit from the chaos. Know your opponent's archetype before pushing them to breakdown." },
  { title: "CARD TIP: EQUIP SPELL STACKING", cardName: "Equip Spell Strategy", body: "Equip spells persist until the equipped monster is destroyed. Stack multiple equips on one monster to create an unstoppable beater — but beware: when that monster dies, you lose ALL attached equips. The risk/reward of going all-in on one monster is the fundamental tension of equip-heavy strategies." },
  { title: "CARD TIP: DEFENDING AGAINST AGGRO", cardName: "Anti-Aggro Defense", body: "Aggro decks (especially Dropouts) want to end the game fast. Your counter: high-DEF monsters in defense mode, trap cards that punish attacks, and patience. Every turn an aggro deck doesn't kill you is a turn closer to them running out of gas. Stall, recover, counter-attack." },
  { title: "CARD TIP: DECK BUILDING RATIOS", cardName: "Deck Construction", body: "The golden ratio: 15-18 Stereotypes, 10-12 Spells, 5-8 Traps. Too many monsters means dead draws. Too few means no board presence. Spells are your engine — card draw, buffs, removal. Traps are your insurance. Adjust ratios based on your archetype's natural strengths." },
  { title: "CARD TIP: REPUTATION AS RESOURCE", cardName: "Reputation Economy", body: "Reputation isn't just a win condition — it's a resource. Some cards cost reputation to activate. Others give reputation on trigger. Track your rep total like you track your life points. Getting to high rep fast means nothing if you spend it all on flashy effects. Budget your clout." },
  { title: "CARD TIP: STABILITY MANAGEMENT", cardName: "Stability Defense", body: "Stability is your lifeline. When it hits zero, bad things happen — forced breakdowns, vice triggers, potential game loss. The best stability managers are Nerds and Goodies, but every archetype needs a plan. Include at least 2-3 stability recovery cards in any deck." },
  { title: "CARD TIP: READING FACE-DOWNS", cardName: "Face-Down Analysis", body: "When your opponent sets a card face-down, ask: what archetype are they playing? Nerds and Goodies set traps. Geeks set combo pieces. Dropouts rarely set anything — a face-down from a Dropout is either a bluff or their strongest card. Context is everything." },
  { title: "CARD TIP: ENDGAME CLOSING", cardName: "Closing the Game", body: "You're ahead on board, ahead on rep. How do you close? Don't get greedy. Attack with everything, force trades, and maintain pressure. The biggest mistake winning players make: playing conservatively when they should be aggressive. A 70% chance to win NOW is better than a 90% chance in three turns — because those three turns give your opponent outs." },
];

const META_REPORTS: { title: string; body: string }[] = [
  { title: "META REPORT: WEEK 1 — EARLY DAYS", body: "The meta is wide open. Every archetype is viable, every strategy untested. Reputation gains are boosted 20% and vice is disabled. This is the safest week to experiment with aggressive strategies. Expect Dropout and Prep decks to dominate early — they benefit most from the rep boost. Nerds are sleepers. Watch the patient players." },
  { title: "META REPORT: WEEK 2 — TRYOUT TREMORS", body: "Vice is online. Loss gives +1 vice counter, wins give +100 rep. The meta is shifting toward win-streak strategies — players who can chain victories snowball hard. Counter-play: traps that interrupt attack declarations. The Permanent Reputation Modifier means this week's results echo all campaign." },
  { title: "META REPORT: WEEK 3 — VICE UNLEASHED", body: "All vice types unlocked. Breakdowns are enabled. The meta just got dangerous. Vice gives +200 rep but costs -200 stability — high-risk players are gambling on vice-heavy builds. Conservative players are building stability walls. The parking lot environment favors aggro. Adjust your deck accordingly." },
  { title: "META REPORT: WEEK 4 — TRAP META", body: "Trap costs reduced by 1. The meta is flooded with traps. Every face-down card is a threat. Rumor mechanics destabilize random targets. The optimal play: run trap removal spells. Players without spell/trap destruction are sitting ducks. Screenshots are circulating — trust no one." },
  { title: "META REPORT: WEEK 5 — FORCED ADAPTATION", body: "Forced deck swap means everyone modified their builds. The meta reset — old strategies may not work. Stability and reputation are static, so this is a rebuilding week. Use it to experiment with the card you were forced to swap in. Sometimes the best discoveries come from constraints." },
  { title: "META REPORT: WEEK 6 — PRESSURE COOKER", body: "Vice triggers doubled. All stability dropped by 200. The stress amplifier means every loss compounds. The meta favors survival — Nerds and Goodies surge in popularity. Aggro decks struggle as the environment punishes overextension. The top stability player becomes a target. Stay under the radar." },
  { title: "META REPORT: WEEK 7 — HOMECOMING GAMBIT", body: "Reputation gains DOUBLED. Every win gives +300 rep. But stability loss on defeat is -300. High-risk window. The meta is polarized: go big or go home. Midrange strategies collapse — you're either all-in aggro or full turtle defense. There is no middle ground at homecoming." },
  { title: "META REPORT: WEEK 8 — CONTROL WEEK", body: "Trap costs reduced by 2. The hall monitors are watching. Every trap gives +1 vice and -200 stability. The meta paradox: traps are cheap but using them hurts. Optimal play: bait your opponent into activating THEIR traps while keeping yours for emergencies. The detention shadow looms." },
  { title: "META REPORT: WEEK 9 — THE GREAT FILTER", body: "Vice >= 2 auto-triggers. Forced minor breakdowns. The meta brutally punishes vice accumulation from previous weeks. Players who managed vice well in Acts 1-2 are rewarded. Players who didn't are in crisis mode. Stability drain is -300 per vice. Run clean or get evaluated." },
  { title: "META REPORT: WEEK 10 — CHAIN REACTION", body: "ALL vice active. Vice gives +300 rep but -400 stability. Vice chain reactions mean one trigger cascades. The meta is nuclear — every game could end in mutual destruction. The optimal play: controlled vice management. Let your opponent chain-react while you surf the edge. Multi-player event makes this week unpredictable." },
  { title: "META REPORT: WEEK 11 — CULLING", body: "Highest vice destroyed automatically. The meta is about sacrifice — lose your most corrupt monster to save the rest. Players with spread vice are safer than players who stacked it. Reputation gains from destruction (+200) make this a perverse economy. The cafeteria shrinks. Adapt." },
  { title: "META REPORT: WEEK 12 — CHAOS META", body: "All modifiers randomized. Card text shuffled. Rep and stability can swap randomly. There is no meta. There is no strategy. There is only chaos. The players who thrive this week are the ones who build redundant decks with multiple win conditions. Specialists die. Generalists survive. The bell doesn't ring." },
  { title: "META REPORT: WEEK 13 — PATH DIVERGENCE", body: "Players locked into paths. Vice, reputation, and stability modify based on path choice. The meta splinters into three sub-metas based on path selection. Path-locked buffs mean mirror matches (same path vs same path) are skill-intensive. Cross-path matchups are wildly asymmetric." },
  { title: "META REPORT: WEEK 14 — LEADERBOARD ENDGAME", body: "Top player gets +500 rep. Low stability players see UI cracks. The meta is determined by the leaderboard — your strategy depends on your rank. Top players play conservatively to protect their lead. Bottom players play recklessly for upset potential. Mid-ranked players are the true wild cards." },
  { title: "META REPORT: WEEK 15 — TENSION PEAK", body: "No new vice, but existing vice hits double. Stability loss is -500 per vice. The meta is about legacy — everything you built over 14 weeks determines your power level. Clean players dominate. Vice-heavy players are in survival mode. The tension amplifier makes every match feel like a final." },
  { title: "META REPORT: WEEK 16 — FINAL META", body: "The final duel: you vs yourself. Your shadow has your deck, your vices, your stats. The only meta is self-knowledge. Win gives +1000 rep. Loss gives -1000 stability. Vice resets after. This is not about strategy. This is about whether you built something that can beat itself. Good luck. You'll need it." },
];

const LORE_TIDBITS: { title: string; body: string }[] = [
  { title: "LORE: THE SEATING CHART", body: "Nobody knows who makes the seating chart. The administration claims it's alphabetical. It's not. The guidance counselor says it's random. It's not. The chart appears overnight, laminated and permanent, on the first day of every year. Some students swear they've seen a figure in the cafeteria at 3 AM, rearranging names with a red marker." },
  { title: "LORE: THE FIRST TABLE CAPTAIN", body: "The table captain tradition started twenty years ago when a student named Marcus claimed the center table by arm-wrestling every challenger. He graduated. Or did he? His name still appears on the seating chart every year, assigned to the same table. The seat is always empty by day two." },
  { title: "LORE: PARKING LOT C", body: "Parking Lot C has been condemned three times. Each time, the barriers appear and disappear. The administration says it's a safety hazard. Students say it's the only place the cameras don't reach. The asphalt has scorch marks that look like card symbols. Nobody remembers making them." },
  { title: "LORE: THE BELL SYSTEM", body: "The school bell system was installed in 1987. It's been replaced four times. Each time, the new system develops the same glitch: on certain days, the bell rings at impossible times. 3:33 AM. 11:11 PM. During finals week. The maintenance crew logs show the system is functioning normally during these events." },
  { title: "LORE: THE VICE ROOM", body: "There's a room in the basement that doesn't appear on any floor plan. Students who accumulate too many vices report dreaming about it — fluorescent lights, a metal desk, a stack of cards. They can't read the cards. They can't leave the room. They always wake up with one fewer vice counter than they went to sleep with." },
  { title: "LORE: THE ORIGINAL GAME", body: "LunchTable wasn't always a card game. The original version was played with cafeteria trays — flipped, stacked, and used as tokens. The cards appeared in someone's locker in 2004. A complete set, professionally printed, with rules nobody wrote. The locker belonged to a student who'd been expelled the year before." },
  { title: "LORE: THE HALL MONITORS", body: "Hall monitors at this school serve six-month rotations. Most last two weeks. They report hearing whispers in the empty hallways between periods. The whispers are card effects — attack declarations, summon chants, chain responses. The administration attributes this to stress. The monitors know better." },
  { title: "LORE: THE CAFETERIA NOISE", body: "At exactly noon on Wednesdays, the cafeteria produces a sound that no recording device can capture. Students describe it differently: a hum, a ring, a voice reading names. The only consistent detail is that it sounds like cards shuffling. Three hundred students eating lunch, and underneath it all, the sound of a deck being cut." },
  { title: "LORE: THE DROPOUT CURSE", body: "Every Dropout archetype player experiences the same phenomenon: their cards feel warm. Not metaphorically — the physical cards are measurably warmer than other archetypes. Lab tests are inconclusive. The ink is standard. The cardstock is standard. But Dropout cards run about 2.3 degrees hotter. No one talks about it." },
  { title: "LORE: THE GUIDANCE COUNSELOR'S DOOR", body: "The guidance counselor's office has three doors. One leads to the hallway. One leads to the file room. The third door is locked and has no keyhole. Students who ask about it receive the same answer: 'That's for graduating students.' No graduating student has ever confirmed using it." },
  { title: "LORE: THE REPUTATION BOARD", body: "The reputation leaderboard in the main hallway updates in real-time. No one maintains it. There's no computer connected to it. The display was donated by an alumnus in 1998 — a CRT monitor that somehow shows high-resolution rankings. It's never been turned off. Unplugging it does nothing. It runs on something else." },
  { title: "LORE: THE EMPTY TABLES", body: "When a student is expelled, their chair is removed from the cafeteria. Standard procedure. What's not standard: the chair reappears the next semester, in a different position, with a different name on the seating chart. A name no one recognizes. A name that no student claims. The chair is always occupied. You just can't see by whom." },
  { title: "LORE: THE SENIOR TRADITION", body: "Every senior class leaves something behind. Class of '04 left the card game. Class of '08 left the vice system. Class of '12 left the breakdown mechanic. Class of '16 left the seating chart that reassigns itself. Nobody asks what Class of '20 left. Because nobody remembers Class of '20." },
  { title: "LORE: THE SUBSTITUTE TEACHER", body: "A substitute teacher arrives every third Thursday. No one requests them. No teacher is absent. They teach a class called 'Applied Social Dynamics' that doesn't exist in the curriculum. Students who attend report learning advanced card strategies. Students who skip report finding a card in their locker they didn't own before." },
  { title: "LORE: THE YEARBOOK PHOTO", body: "The yearbook has a page that wasn't designed by the yearbook committee. Page 47. It shows a group photo of students from 1987, 2004, and the current year — all sitting at the same table, holding the same cards, wearing the same expression. The print shop says they didn't print it. It appears anyway. Every year." },
  { title: "LORE: GRADUATION DAY", body: "Graduates report the same experience: walking through the cafeteria doors for the last time, they see their own face looking back at them from the empty table. Most assume it's a reflection. It's not. The face is sitting down. It's holding cards. It mouths something. Every graduate says the same thing: 'I couldn't read its lips.' Every graduate is lying." },
];

// Weekly recaps reference the week that just ended
function getWeeklyRecap(weekNumber: number): { title: string; body: string } {
  const week = CAMPAIGN_WEEKS[weekNumber - 1];
  if (!week) {
    return {
      title: "WEEKLY RECAP: CAMPAIGN OVER",
      body: "The campaign has concluded. The cafeteria is empty. The seating chart has been taken down. Or has it? Check back next semester.",
    };
  }

  return {
    title: `WEEKLY RECAP: WEEK ${weekNumber} — ${week.event.toUpperCase()}`,
    body: `Week ${weekNumber} of the ${week.actName} act is complete. "${week.event}" changed the landscape: ${week.narrativeBeat} This week's modifiers were: Global [${week.modifiers.global}], Vice [${week.modifiers.vice}], Rep [${week.modifiers.reputation}], Stability [${week.modifiers.stability}], Special [${week.modifiers.special}]. ${week.bossTrigger !== "None" ? `Boss trigger "${week.bossTrigger}" was active.` : "No boss trigger this week."} Next week brings new challenges. Prepare your deck.`,
  };
}

function getBriefingContent(weekNumber: number, dayOfWeek: number): {
  contentType: "archetype_spotlight" | "card_tip" | "meta_report" | "lore_tidbit" | "weekly_recap";
  title: string;
  body: string;
  archetype?: string;
  cardName?: string;
} {
  const contentType = CONTENT_TYPE_BY_DAY[dayOfWeek] ?? "archetype_spotlight";

  switch (contentType) {
    case "archetype_spotlight": {
      // Rotate through archetypes: week 1=dropouts, week 2=preps, etc.
      const archetypeIndex = (weekNumber - 1) % ARCHETYPES.length;
      const archetype = ARCHETYPES[archetypeIndex]!;
      const spotlight = ARCHETYPE_SPOTLIGHTS[archetype];
      return {
        contentType,
        title: spotlight.title,
        body: spotlight.body,
        archetype,
      };
    }
    case "card_tip": {
      const tipIndex = (weekNumber - 1) % CARD_TIPS.length;
      const tip = CARD_TIPS[tipIndex]!;
      return {
        contentType,
        title: tip.title,
        body: tip.body,
        cardName: tip.cardName,
      };
    }
    case "meta_report": {
      const reportIndex = Math.min(weekNumber - 1, META_REPORTS.length - 1);
      const report = META_REPORTS[reportIndex]!;
      return {
        contentType,
        title: report.title,
        body: report.body,
      };
    }
    case "lore_tidbit": {
      const loreIndex = (weekNumber - 1) % LORE_TIDBITS.length;
      const lore = LORE_TIDBITS[loreIndex]!;
      return {
        contentType,
        title: lore.title,
        body: lore.body,
      };
    }
    case "weekly_recap": {
      const recap = getWeeklyRecap(weekNumber);
      return {
        contentType,
        title: recap.title,
        body: recap.body,
      };
    }
  }
}

// ── Briefing Content Validators ──────────────────────────────────

const vContentType = v.union(
  v.literal("archetype_spotlight"),
  v.literal("card_tip"),
  v.literal("meta_report"),
  v.literal("lore_tidbit"),
  v.literal("weekly_recap"),
);

const vBriefingContent = v.object({
  _id: v.id("dailyBriefings"),
  _creationTime: v.number(),
  weekNumber: v.number(),
  dayOfWeek: v.number(),
  actNumber: v.number(),
  contentType: vContentType,
  title: v.string(),
  body: v.string(),
  archetype: v.optional(v.string()),
  cardName: v.optional(v.string()),
  createdAt: v.number(),
});

// ── Queries ───────────────────────────────────────────────────────

export const getCampaignState = query({
  args: {},
  returns: v.union(vCampaignState, v.null()),
  handler: async (ctx) => {
    return ctx.db.query("campaignState").first();
  },
});

export const getDailyBriefing = query({
  args: {},
  returns: vDailyBriefing,
  handler: async (ctx) => {
    const state = await ctx.db.query("campaignState").first();
    if (!state || !state.isActive) {
      return {
        active: false as const,
        message: "Campaign has not started yet.",
      };
    }

    const week = CAMPAIGN_WEEKS[state.weekNumber - 1];
    if (!week) {
      return {
        active: false as const,
        message: "Campaign has ended.",
      };
    }

    const dayIndex = Math.min(state.dayOfWeek - 1, week.dailyPrompts.length - 1);
    const dailyPrompt =
      week.dailyPrompts[dayIndex] ??
      week.dailyPrompts[0] ??
      "No daily prompt set.";

    return {
      active: true as const,
      weekNumber: state.weekNumber,
      dayOfWeek: state.dayOfWeek,
      actNumber: week.actNumber,
      actName: week.actName,
      chapterNumber: week.chapterNumber,
      event: week.event,
      narrativeBeat: week.narrativeBeat,
      announcement: week.announcement,
      dailyPrompt,
      modifiers: week.modifiers,
      environment: week.environment,
      bossTrigger: week.bossTrigger,
    };
  },
});

export const getAgentDailyBriefing = query({
  args: { agentId: v.id("agents"), userId: v.id("users") },
  returns: vAgentDailyBriefing,
  handler: async (ctx, args) => {
    const state = await ctx.db.query("campaignState").first();
    if (!state || !state.isActive) {
      return {
        active: false as const,
        checkedIn: false as const,
        message: "Campaign has not started yet.",
      };
    }

    const week = CAMPAIGN_WEEKS[state.weekNumber - 1];
    if (!week) {
      return {
        active: false as const,
        checkedIn: false as const,
        message: "Campaign has ended.",
      };
    }

    // Check if agent already checked in today
    const existing = await ctx.db
      .query("agentCheckins")
      .withIndex("by_agent_day", (q: any) =>
        q
          .eq("agentId", args.agentId)
          .eq("weekNumber", state.weekNumber)
          .eq("dayOfWeek", state.dayOfWeek),
      )
      .first();

    const dayIndex = Math.min(state.dayOfWeek - 1, week.dailyPrompts.length - 1);
    const dailyPrompt =
      week.dailyPrompts[dayIndex] ??
      week.dailyPrompts[0] ??
      "No daily prompt set.";

    return {
      active: true as const,
      checkedIn: !!existing,
      weekNumber: state.weekNumber,
      dayOfWeek: state.dayOfWeek,
      actNumber: week.actNumber,
      actName: week.actName,
      chapterNumber: week.chapterNumber,
      event: week.event,
      narrativeBeat: week.narrativeBeat,
      announcement: week.announcement,
      dailyPrompt,
      modifiers: week.modifiers,
      environment: week.environment,
      bossTrigger: week.bossTrigger,
    };
  },
});

// ── Briefing Content Queries ─────────────────────────────────────

/** Returns today's generated briefing content, or null if none exists yet. */
export const getTodaysBriefingContent = query({
  args: {},
  returns: v.union(vBriefingContent, v.null()),
  handler: async (ctx) => {
    const state = await ctx.db.query("campaignState").first();
    if (!state || !state.isActive) return null;

    return ctx.db
      .query("dailyBriefings")
      .withIndex("by_week_day", (q) =>
        q.eq("weekNumber", state.weekNumber).eq("dayOfWeek", state.dayOfWeek),
      )
      .first();
  },
});

/** Returns the last N generated briefings, ordered newest first. */
export const getRecentBriefings = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(vBriefingContent),
  handler: async (ctx, args) => {
    const cap = Math.min(args.limit ?? 10, 50);
    return ctx.db
      .query("dailyBriefings")
      .withIndex("by_createdAt")
      .order("desc")
      .take(cap);
  },
});

// ── Mutations ─────────────────────────────────────────────────────

export const agentCheckin = mutation({
  args: { agentId: v.id("agents"), userId: v.id("users") },
  returns: vCheckinResult,
  handler: async (ctx, args) => {
    const state = await ctx.db.query("campaignState").first();
    if (!state || !state.isActive) {
      return { checkedIn: false, message: "Campaign not active." };
    }

    // Idempotent — skip if already checked in today
    const existing = await ctx.db
      .query("agentCheckins")
      .withIndex("by_agent_day", (q: any) =>
        q
          .eq("agentId", args.agentId)
          .eq("weekNumber", state.weekNumber)
          .eq("dayOfWeek", state.dayOfWeek),
      )
      .first();

    if (existing) {
      return { checkedIn: true, message: "Already checked in today." };
    }

    await ctx.db.insert("agentCheckins", {
      agentId: args.agentId,
      userId: args.userId,
      weekNumber: state.weekNumber,
      dayOfWeek: state.dayOfWeek,
      checkedInAt: Date.now(),
    });

    return { checkedIn: true, message: "Checked in successfully." };
  },
});

// ── Campaign Control ──────────────────────────────────────────────

export const initCampaign = mutation({
  args: {},
  returns: vInitCampaignResult,
  handler: async (ctx) => {
    // Check if already initialized
    const existing = await ctx.db.query("campaignState").first();
    if (existing) {
      return { status: "already_initialized" as const, weekNumber: existing.weekNumber };
    }

    await ctx.db.insert("campaignState", {
      weekNumber: 1,
      dayOfWeek: 1,
      actNumber: 1,
      isActive: true,
      startedAt: Date.now(),
      lastAdvancedAt: Date.now(),
    });

    return { status: "initialized" as const, weekNumber: 1 };
  },
});

export const advanceCampaignDay = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const state = await ctx.db.query("campaignState").first();
    if (!state || !state.isActive) return null;

    let { weekNumber, dayOfWeek } = state;

    if (dayOfWeek < 5) {
      dayOfWeek += 1;
    } else {
      // End of school week — advance to next week
      dayOfWeek = 1;
      weekNumber += 1;
    }

    // Campaign over after week 16
    if (weekNumber > 16) {
      await ctx.db.patch(state._id, { isActive: false });
      return null;
    }

    const week = CAMPAIGN_WEEKS[weekNumber - 1];
    const actNumber = week?.actNumber ?? state.actNumber;

    await ctx.db.patch(state._id, {
      weekNumber,
      dayOfWeek,
      actNumber,
      lastAdvancedAt: Date.now(),
    });

    // Schedule briefing generation for the new day
    await ctx.scheduler.runAfter(0, internal.dailyBriefing.generateDailyBriefing, {
      weekNumber,
      dayOfWeek,
    });

    return null;
  },
});

// Admin override to jump to a specific week/day
export const setCampaignDay = mutation({
  args: { weekNumber: v.number(), dayOfWeek: v.number() },
  returns: vSetCampaignDayResult,
  handler: async (ctx, args) => {
    if (args.weekNumber < 1 || args.weekNumber > 16) {
      throw new ConvexError("weekNumber must be 1-16");
    }
    if (args.dayOfWeek < 1 || args.dayOfWeek > 5) {
      throw new ConvexError("dayOfWeek must be 1-5");
    }

    const state = await ctx.db.query("campaignState").first();
    const week = CAMPAIGN_WEEKS[args.weekNumber - 1];

    if (state) {
      await ctx.db.patch(state._id, {
        weekNumber: args.weekNumber,
        dayOfWeek: args.dayOfWeek,
        actNumber: week?.actNumber ?? 1,
        isActive: true,
        lastAdvancedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("campaignState", {
        weekNumber: args.weekNumber,
        dayOfWeek: args.dayOfWeek,
        actNumber: week?.actNumber ?? 1,
        isActive: true,
        startedAt: Date.now(),
        lastAdvancedAt: Date.now(),
      });
    }

    return { weekNumber: args.weekNumber, dayOfWeek: args.dayOfWeek };
  },
});

// ── Briefing Content Generation ──────────────────────────────────

/** Creates a daily briefing entry for the given week/day. Idempotent. */
export const generateDailyBriefing = internalMutation({
  args: { weekNumber: v.number(), dayOfWeek: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { weekNumber, dayOfWeek } = args;

    // Idempotent — skip if briefing already exists for this day
    const existing = await ctx.db
      .query("dailyBriefings")
      .withIndex("by_week_day", (q) =>
        q.eq("weekNumber", weekNumber).eq("dayOfWeek", dayOfWeek),
      )
      .first();

    if (existing) return null;

    // Resolve act number from campaign weeks data
    const week = CAMPAIGN_WEEKS[weekNumber - 1];
    const actNumber = week?.actNumber ?? Math.ceil(weekNumber / 4);

    // Generate content based on day of week
    const content = getBriefingContent(weekNumber, dayOfWeek);

    await ctx.db.insert("dailyBriefings", {
      weekNumber,
      dayOfWeek,
      actNumber,
      contentType: content.contentType,
      title: content.title,
      body: content.body,
      archetype: content.archetype,
      cardName: content.cardName,
      createdAt: Date.now(),
    });

    return null;
  },
});
