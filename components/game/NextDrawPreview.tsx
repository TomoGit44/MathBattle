// NextDrawPreview: 次ターンに配られることが確定済みのカード一覧を表示する小さなUI。
//
// - 両プレイヤー公開: 自分も相手の予告も見える (情報の非対称性は廃止)
// - me 用: data-draw-anchor 属性を持たせ、CardOrbOverlay の玉飛行の発信元として使う
// - 空配列のときは枠数表示だけ (slot=0 の演出を含む)

import type { HandItem } from '@/lib/types'
import { handItemLabel } from '@/lib/types'
import { isPrimeBullet } from '@/lib/prime'

interface NextDrawPreviewProps {
  /** プレビュー対象のカード列 (サーバー権威でロック済み) */
  cards: HandItem[]
  /** 自分のもの (true) か相手のもの (false) */
  isMe: boolean
  /** CardOrbOverlay が発信元として参照する識別子 (= playerId)。isMe=true のときのみ意味あり */
  anchorId?: string
}

const colorForItem = (item: HandItem): string => {
  if (item.type === 'operator') return 'text-op-mul border-op-mul-border bg-op-mul-bg'
  if (item.type === 'move') return 'text-axis-origin border-axis-origin/50 bg-bg-elev'
  if (item.type === 'function') return 'text-op-add border-op-add-border bg-op-add-bg italic'
  // number / token
  const isInf = !Number.isFinite(item.value)
  if (isInf) return 'text-warn border-warn bg-bg-deep'
  if (isPrimeBullet(item.value)) return 'text-prime-edge border-prime-edge bg-bg-elev'
  return 'text-p1 border-p1-deep bg-p1-bg'
}

export const NextDrawPreview = ({ cards, isMe, anchorId }: NextDrawPreviewProps) => {
  return (
    <div
      data-draw-anchor={isMe ? anchorId : undefined}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-line-soft bg-bg-mid/70 mb-tabular"
      aria-label={isMe ? '次ターンの補充カード (自分)' : '次ターンの補充カード (相手)'}
    >
      <span className="text-[10px] uppercase tracking-wider text-text-faint">
        {isMe ? 'NEXT' : 'OPP-NEXT'}
      </span>
      {cards.length === 0 ? (
        <span className="text-xs text-text-mute">—</span>
      ) : (
        <div className="flex items-center gap-1">
          {cards.map((c, i) => (
            <span
              key={i}
              className={`inline-flex items-center justify-center w-6 h-7 rounded border text-xs font-bold ${colorForItem(c)}`}
              style={{
                boxShadow:
                  (c.type === 'number' || c.type === 'token') && !Number.isFinite(c.value)
                    ? '0 0 6px var(--color-warn)'
                    : undefined,
              }}
            >
              {handItemLabel(c)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
