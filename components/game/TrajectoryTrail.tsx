import type { BulletTrajectory } from '@/lib/trajectory'

interface TrajectoryTrailProps {
  trajectory: BulletTrajectory
  isOwn: boolean
  bulletRadius: number
  fieldSize: { width: number; height: number }
}

export const TrajectoryTrail = ({
  trajectory,
  isOwn,
  bulletRadius,
  fieldSize,
}: TrajectoryTrailProps) => {
  const { points, finalPosition, finalValue } = trajectory
  if (points.length < 2) return null

  // 途中の点 (最初=現在位置は除く、最後=終点も別途描画)
  const trailPoints = points.slice(1)
  const totalPoints = trailPoints.length

  const baseColor = isOwn ? 'bg-blue-400' : 'bg-red-400'
  const finalBorder = isOwn ? 'border-blue-400' : 'border-red-400'
  const finalText = isOwn ? 'text-blue-300' : 'text-red-300'
  const finalBg = isOwn ? 'bg-blue-400/20' : 'bg-red-400/20'

  // 弾と同じサイズ (直径) で終点マーカーを描画
  const finalWidthPct = ((bulletRadius * 2) / fieldSize.width) * 100
  const finalHeightPct = ((bulletRadius * 2) / fieldSize.height) * 100

  // 軌跡ドットの最大サイズは弾の半径相当 (弾より少し小さく)
  const dotMinPx = Math.max(2, bulletRadius * 0.3)
  const dotMaxPx = Math.max(dotMinPx + 1, bulletRadius * 0.8)

  return (
    <>
      {/* 軌跡ドット: 始点側が薄く、終点側が濃い */}
      {trailPoints.map((point, i) => {
        const left = (point.position.x / fieldSize.width) * 100
        const top = (point.position.y / fieldSize.height) * 100
        // 始点側 0.08 → 終点側 0.35 のグラデーション
        const opacity = 0.08 + (i / Math.max(totalPoints - 1, 1)) * 0.27
        // 終点に近づくほど少し大きく
        const size = dotMinPx + (i / Math.max(totalPoints - 1, 1)) * (dotMaxPx - dotMinPx)

        const isLast = i === totalPoints - 1

        if (isLast) return null // 最後は別途描画

        return (
          <div
            key={`trail-${trajectory.bulletId}-${i}`}
            className={`absolute rounded-full ${baseColor} pointer-events-none -translate-x-1/2 -translate-y-1/2`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity,
            }}
          />
        )
      })}

      {/* 終点マーカー: 弾の最終到達地点 (弾と同サイズ) */}
      {(() => {
        const left = (finalPosition.x / fieldSize.width) * 100
        const top = (finalPosition.y / fieldSize.height) * 100
        return (
          <div
            className={`absolute ${finalBg} ${finalBorder} ${finalText} border-2 border-dashed rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold pointer-events-none`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${finalWidthPct}%`,
              height: `${finalHeightPct}%`,
              opacity: 0.6,
            }}
          >
            {finalValue}
          </div>
        )
      })()}
    </>
  )
}
