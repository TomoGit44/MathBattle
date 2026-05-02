'use client'

/**
 * 低 HP 時に画面端から滲む赤いビネット。
 * HP <= 25% で表示し、ゆっくり脈動 (opacity のみ — GPU レイヤ維持)。
 *
 * 親で `hp <= INITIAL_HP * 0.25` の判定をしてから render する想定。
 * このコンポーネント自体は表示の責務だけ持つ。
 */
interface LowHpVignetteProps {
  /** 強さを微調整したいときに 0..1 で渡す。デフォルト 1。 */
  intensity?: number
}

export const LowHpVignette = ({ intensity = 1 }: LowHpVignetteProps) => {
  const inner = 30 + (1 - intensity) * 20 // 中央から赤が薄くなる距離
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30"
      style={{
        background: `radial-gradient(ellipse at center, transparent ${inner}%, rgba(248, 113, 113, 0.55) 100%)`,
        animation: 'mb-vignette 1.4s var(--ease-in-out) infinite',
        mixBlendMode: 'screen',
      }}
    />
  )
}
