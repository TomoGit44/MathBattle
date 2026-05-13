/**
 * デッキアイコン: フィールド HUD に表示される「カードの束」絵。
 * - CSS のみで 3 枚重ねを表現 (画像不要)
 * - 残枚数を中央に表示
 * - reshuffling=true で再シャッフル演出 (回転 + 発光) を一時的に発火
 * - data-deck-icon 属性で CardOrbOverlay が画面座標を取得する
 */

import { useEffect, useRef, useState } from 'react'

interface DeckIconProps {
  /** 残枚数 */
  count: number
  /** 自分のデッキか相手のデッキか (色分け) */
  side: 'me' | 'opponent'
  /** true の間、再シャッフル演出を再生 (親が一定時間後に false に戻す) */
  reshuffling?: boolean
  /** CardOrbOverlay が玉の発信元座標を取得するためのキー (両プレイヤーで同居しないように一意) */
  ownerId: string
}

export const DeckIcon = ({ count, side, reshuffling, ownerId }: DeckIconProps) => {
  // 内部キー: reshuffling が true → false に変わるたびにキーを更新してアニメを最後まで流す
  const [shuffleKey, setShuffleKey] = useState(0)
  const prevReshuffling = useRef(false)
  useEffect(() => {
    if (reshuffling && !prevReshuffling.current) {
      setShuffleKey((k) => k + 1)
    }
    prevReshuffling.current = !!reshuffling
  }, [reshuffling])

  const accent = side === 'me' ? 'var(--color-p1-border)' : 'var(--color-p2-border)'
  const accentBg = side === 'me' ? 'var(--color-p1-bg)' : 'var(--color-p2-bg)'
  const glow = side === 'me' ? 'var(--color-p1-glow)' : 'var(--color-p2-glow)'

  return (
    <div
      data-deck-icon={ownerId}
      className="relative inline-flex items-center justify-center mb-tabular"
      style={{
        width: 36,
        height: 48,
        perspective: 200,
      }}
      aria-label={`デッキ残${count}枚`}
    >
      {/* 奥の2枚 (重なり表現) */}
      <span
        aria-hidden
        className="absolute pointer-events-none rounded-md"
        style={{
          inset: 0,
          transform: 'translate(3px, 3px)',
          background: accentBg,
          border: `1px solid ${accent}`,
          opacity: 0.45,
        }}
      />
      <span
        aria-hidden
        className="absolute pointer-events-none rounded-md"
        style={{
          inset: 0,
          transform: 'translate(1.5px, 1.5px)',
          background: accentBg,
          border: `1px solid ${accent}`,
          opacity: 0.7,
        }}
      />
      {/* 表側 (リシャッフル時のみキーフレームを発火) */}
      <span
        key={shuffleKey}
        className="relative rounded-md flex items-center justify-center font-bold mb-tabular"
        style={{
          width: '100%',
          height: '100%',
          background: accentBg,
          border: `1.5px solid ${accent}`,
          color: accent,
          boxShadow: reshuffling
            ? `0 0 18px ${glow}, 0 0 36px ${glow}`
            : `0 0 6px ${glow}`,
          fontSize: 11,
          letterSpacing: '0.05em',
          animation: reshuffling
            ? 'mb-deck-reshuffle var(--dur-cinema) var(--ease-glide) 1'
            : undefined,
          willChange: 'transform, filter',
        }}
      >
        {reshuffling ? '⟳' : count}
      </span>
    </div>
  )
}
