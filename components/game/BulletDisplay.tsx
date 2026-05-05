import type { MouseEvent } from 'react'
import type { Bullet } from '@/lib/types'
import { isPrimeBullet } from '@/lib/prime'
import { PrimeAura } from './PrimeAura'

interface BulletDisplayProps {
  bullet: Bullet
  isOwn: boolean
  bulletRadius: number
  fieldSize: { width: number; height: number }
  onClick?: (bullet: Bullet, e: MouseEvent) => void
}

/**
 * 弾の見た目: 値が大きいほど「重い」スプライト感を与える。
 *   - サイズ: ベース 100% から最大 +30% (clamp)
 *   - グロー: blur と spread が値とともに強くなる
 *   - 数字: ネオン LED 風 text-shadow (フォントは現行維持・tabular-nums のみ)
 *
 * 素数弾は別軸: violet + ガラス白の PrimeAura を被せる。
 */
export const BulletDisplay = ({
  bullet,
  isOwn,
  bulletRadius,
  fieldSize,
  onClick,
}: BulletDisplayProps) => {
  const left = (bullet.position.x / fieldSize.width) * 100
  const top = (bullet.position.y / fieldSize.height) * 100

  const isInfinity = !Number.isFinite(bullet.value)

  // 値による「重み」スケール (1.0 〜 1.30) — 値 30 でほぼ最大に
  // 無限弾は最大の重みで描画
  const absVal = isInfinity ? 30 : Math.abs(bullet.value)
  const weight = Math.min(absVal / 30, 1)
  const sizeMult = isInfinity ? 1.5 : 1 + weight * 0.3
  const widthPct = ((bulletRadius * 2 * sizeMult) / fieldSize.width) * 100
  const heightPct = ((bulletRadius * 2 * sizeMult) / fieldSize.height) * 100

  const isPrime = isPrimeBullet(bullet.value)

  // 素数弾は violet + ガラス白、無限弾は warn (黄)、通常弾は所有者カラー
  const color = isInfinity
    ? 'bg-bg-deep border-warn text-warn'
    : isPrime
    ? 'bg-prime-bg border-prime-edge text-prime-text'
    : isOwn
    ? 'bg-p1-bg border-p1-border text-p1'
    : 'bg-p2-bg border-p2-border text-p2'

  const glowColor = isInfinity
    ? 'var(--color-warn)'
    : isPrime
    ? 'var(--color-prime-edge)'
    : isOwn
    ? 'var(--color-p1)'
    : 'var(--color-p2)'
  const glowSize = isInfinity ? 22 : 6 + weight * 14
  const glowSpread = isInfinity ? 6 : weight * 4

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
      }}
      onClick={onClick ? (e) => onClick(bullet, e) : undefined}
    >
      {isPrime && <PrimeAura shape="circle" />}
      <div
        className={`relative w-full h-full ${color} border rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold mb-tabular`}
        style={{
          boxShadow: isPrime
            ? 'var(--shadow-prime)'
            : `0 0 ${glowSize.toFixed(1)}px ${glowSpread.toFixed(
                1,
              )}px ${glowColor}`,
          // ネオン LED 風: 数字を currentColor の弱グローで縁取り。
          textShadow: isPrime
            ? '0 0 4px var(--color-prime-edge), 0 0 10px var(--color-prime-edge)'
            : `0 0 4px ${glowColor}, 0 0 8px ${glowColor}`,
        }}
      >
        {isInfinity ? '∞' : bullet.value}
      </div>
    </div>
  )
}
