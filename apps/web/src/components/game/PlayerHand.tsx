import { HandCard } from "./HandCard";

interface PlayerHandProps {
  hand: string[];
  cardLookup: Record<string, any>;
  playableIds?: Set<string>;
  onCardClick?: (cardId: string) => void;
}

export function PlayerHand({
  hand,
  cardLookup,
  playableIds,
  onCardClick,
}: PlayerHandProps) {
  return (
    <div className="overflow-visible" style={{ perspective: "600px" }}>
    <div className="flex justify-center items-end pt-10 pb-2 overflow-visible" style={{ transformStyle: "preserve-3d" }}>
      {hand.map((cardId, i) => (
        <HandCard
          key={`${cardId}-${i}`}
          cardId={cardId}
          cardDef={cardLookup[cardId]}
          index={i}
          totalCards={hand.length}
          playable={playableIds?.has(cardId)}
          onClick={onCardClick ? () => onCardClick(cardId) : undefined}
        />
      ))}
    </div>
    </div>
  );
}
