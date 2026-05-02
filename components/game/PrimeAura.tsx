/**
 * 素数オーラ: HandDisplay / BulletDisplay の重複を吸収する共通コンポーネント。
 *
 * 内→外の radial グラデ + 回転外輪。
 * AI-slop の to-r フシアグラデは廃止し、violet + ガラス白に統一。
 *
 * shape は親要素の rounded-* と揃える (rounded-full / rounded-lg)。
 * inset は要素の外側にどれだけはみ出すか (px or string)。
 */
interface PrimeAuraProps {
  shape: 'circle' | 'rounded'
  /** はみ出し量。circle 推奨 '60%', rounded 推奨 '4px' */
  glowInset?: string
  ringInset?: string
}

export const PrimeAura = ({
  shape,
  glowInset = shape === 'circle' ? '-60%' : '-4px',
  ringInset = shape === 'circle' ? '-20%' : '-2px',
}: PrimeAuraProps) => {
  const radius = shape === 'circle' ? '9999px' : '0.5rem'
  return (
    <>
      {/* 内→外の柔らかい光 */}
      <span
        className="pointer-events-none absolute blur-md"
        style={{
          inset: glowInset,
          borderRadius: radius,
          background:
            shape === 'circle'
              ? 'radial-gradient(circle, var(--color-prime) 0%, var(--color-prime-edge) 45%, transparent 75%)'
              : 'radial-gradient(ellipse at center, var(--color-prime) 0%, var(--color-prime-edge) 45%, transparent 75%)',
          opacity: 0.55,
          animation: 'mb-pulse-soft 1.6s var(--ease-in-out) infinite',
        }}
      />
      {/* 回転する外輪 (linear は意図的) */}
      <span
        className="pointer-events-none absolute"
        style={{
          inset: ringInset,
          borderRadius: radius,
          boxShadow: '0 0 0 2px var(--color-prime-edge)',
          animation: 'mb-spin-slow 4s linear infinite',
        }}
      />
    </>
  )
}
