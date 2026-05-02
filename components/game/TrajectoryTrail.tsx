'use client'

import type { BulletTrajectory } from '@/lib/trajectory'

interface TrajectoryTrailProps {
  trajectory: BulletTrajectory
  isOwn: boolean
  bulletRadius: number
  fieldSize: { width: number; height: number }
}

/**
 * 軌跡プレビュー: 弾が次ターン辿るルートを SVG path で描画し、
 * stroke-dasharray + stroke-dashoffset を linear に流して「予測線」感を出す。
 *
 * 終点マーカー (弾の最終到達地点) は破線で囲み、わずかに脈動させる。
 */
export const TrajectoryTrail = ({
  trajectory,
  isOwn,
  bulletRadius,
  fieldSize,
}: TrajectoryTrailProps) => {
  const { points, finalPosition, finalValue } = trajectory
  if (points.length < 2) return null

  const colorVar = isOwn ? 'var(--color-p1)' : 'var(--color-p2)'
  const finalBorder = isOwn ? 'border-p1' : 'border-p2'
  const finalText = isOwn ? 'text-p1' : 'text-p2'
  const finalBg = isOwn ? 'bg-p1/20' : 'bg-p2/20'

  // 終点マーカーのサイズ (弾と同径)
  const finalWidthPct = ((bulletRadius * 2) / fieldSize.width) * 100
  const finalHeightPct = ((bulletRadius * 2) / fieldSize.height) * 100

  // 軌跡 path 構築 (絶対座標 px、SVG viewBox は fieldSize)
  const segments: string[] = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i].position
    segments.push(`${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
  }
  const pathData = segments.join(' ')

  return (
    <>
      {/* 走査線 SVG: linear に dash を流す (linear は意図的・予測線の不可知さを表現) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${fieldSize.width} ${fieldSize.height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* ベースの薄いガイド線 */}
        <path
          d={pathData}
          fill="none"
          stroke={colorVar}
          strokeWidth="1"
          strokeOpacity="0.18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 流れる dash (走査) */}
        <path
          d={pathData}
          fill="none"
          stroke={colorVar}
          strokeWidth="1.6"
          strokeOpacity="0.55"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 10"
          style={{
            animation: 'mb-traj-scan 1.2s linear infinite',
            filter: `drop-shadow(0 0 4px ${colorVar})`,
          }}
        />
      </svg>

      {/* 終点マーカー: わずかに脈動 (transform/opacity のみ) */}
      <div
        className={`absolute ${finalBg} ${finalBorder} ${finalText} border-2 border-dashed rounded-full flex items-center justify-center text-[10px] font-bold pointer-events-none mb-tabular`}
        style={{
          left: `${(finalPosition.x / fieldSize.width) * 100}%`,
          top: `${(finalPosition.y / fieldSize.height) * 100}%`,
          width: `${finalWidthPct}%`,
          height: `${finalHeightPct}%`,
          animation: 'mb-traj-marker 1.6s var(--ease-in-out) infinite',
        }}
      >
        {finalValue}
      </div>
    </>
  )
}
