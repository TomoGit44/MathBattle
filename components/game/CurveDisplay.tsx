import type { MouseEvent } from 'react'
import type { FunctionCurve, GameSettings } from '@/lib/types'
import { evaluateFunction } from '@/lib/func-engine'
import { FIELD_WIDTH, FIELD_HEIGHT, CURVE_SAMPLE_COUNT } from '@/lib/constants'

interface CurveDisplayProps {
  curve: FunctionCurve
  isOwn: boolean
  settings: GameSettings
  onClick?: (curve: FunctionCurve, e: MouseEvent) => void
}

export const CurveDisplay = ({ curve, isOwn, settings, onClick }: CurveDisplayProps) => {
  const color = isOwn ? '#3b82f6' : '#ef4444'
  const { mathXMax, mathYMax } = settings

  // 曲線をサンプリングしてSVGパスを生成
  const step = (2 * mathXMax) / CURVE_SAMPLE_COUNT
  const segments: string[] = []
  let inPath = false

  for (let i = 0; i <= CURVE_SAMPLE_COUNT; i++) {
    const mathX = -mathXMax + step * i
    const mathY = evaluateFunction(curve.expression, mathX)

    if (mathY === null || mathY < -mathYMax || mathY > mathYMax) {
      inPath = false
      continue
    }

    // 数学座標 → SVG viewBox 座標
    const px = ((mathX + mathXMax) / (2 * mathXMax)) * FIELD_WIDTH
    const py = ((mathYMax - mathY) / (2 * mathYMax)) * FIELD_HEIGHT

    if (!inPath) {
      segments.push(`M ${px} ${py}`)
      inPath = true
    } else {
      segments.push(`L ${px} ${py}`)
    }
  }

  const pathData = segments.join(' ')
  if (!pathData) return null

  // ラベル表示位置: x=0 での y 値
  const labelY = evaluateFunction(curve.expression, 0)
  const labelPx = FIELD_WIDTH / 2
  const labelPy = labelY !== null && labelY >= -mathYMax && labelY <= mathYMax
    ? ((mathYMax - labelY) / (2 * mathYMax)) * FIELD_HEIGHT
    : 20

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeOpacity="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {/* タップ用の太い透明パス (タップしやすさ優先) */}
      {onClick && (
        <path
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="stroke"
          style={{ cursor: 'pointer' }}
          onClick={(e) => onClick(curve, e)}
        />
      )}
      <text
        x={labelPx + 5}
        y={Math.max(12, Math.min(FIELD_HEIGHT - 4, labelPy - 8))}
        fill={color}
        fontSize="10"
        fontWeight="bold"
        opacity="0.7"
        pointerEvents="none"
      >
        {curve.displayString}
      </text>
    </svg>
  )
}
