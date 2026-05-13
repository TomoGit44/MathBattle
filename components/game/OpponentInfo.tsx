import type { SanitizedPlayerState, GameSettings } from '@/lib/types'
import { DeckIcon } from './DeckIcon'

interface OpponentInfoProps {
  opponent: SanitizedPlayerState
  settings: GameSettings
}

export const OpponentInfo = ({ opponent, settings }: OpponentInfoProps) => {
  return (
    <div className="flex items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-text-dim justify-end mb-tabular flex-wrap">
      <span>手札: <span className={opponent.handCount >= settings.maxHandSize ? 'text-error font-bold' : ''}>{opponent.handCount}/{settings.maxHandSize}</span>枚</span>
      <DeckIcon count={opponent.deckRemaining} side="opponent" ownerId={opponent.id} />
      <span>関数残: {opponent.functionUsesRemaining}回</span>
    </div>
  )
}
