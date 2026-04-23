import type { FunctionCurve } from '@/lib/types'
import { evaluateFunction } from '@/lib/func-engine'
import { FIELD_WIDTH, FIELD_HEIGHT, MATH_X_MIN, MATH_X_MAX, MATH_Y_MIN, MATH_Y_MAX, CURVE_SAMPLE_COUNT } from '@/lib/constants'

interface CurveDisplayProps {
  curve: FunctionCurve
  isOwn: boolean
}

export const CurveDisplay = ({ curve, isOwn }: CurveDisplayProps) => {
  const color = isOwn ? '#3b82f6' : '#ef4444'

  // 曲線をサンプリングしてSVGパスを生成
  const step = (MATH_X_MAX - MATH_X_MIN) / CURVE_SAMPLE_COUNT
  const segments: string[] = []
  let inPath = false

  for (let i = 0; i <= CURVE_SAMPLE_COUNT; i++) {
    const mathX = MATH_X_MIN + step * i
    const mathY = evaluateFunction(curve.expression, mathX)

    if (mathY === null || mathY < MATH_Y_MIN || mathY > MATH_Y_MAX) {
      inPath = false
      continue
    }

    // 数学座標 → SVGパーセント座標
    const px = ((mathX - MATH_X_MIN) / (MATH_X_MAX - MATH_X_MIN)) * FIELD_WIDTH
    const py = ((MATH_Y_MAX - mathY) / (MATH_Y_MAX - MATH_Y_MIN)) * FIELD_HEIGHT

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
  const labelPy = labelY !== null && labelY >= MATH_Y_MIN && labelY <= MATH_Y_MAX
    ? ((MATH_Y_MAX - labelY) / (MATH_Y_MAX - MATH_Y_MIN)) * FIELD_HEIGHT
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
      />
      {/* 関数ラベル */}
      <text
        x={labelPx + 5}
        y={Math.max(12, Math.min(FIELD_HEIGHT - 4, labelPy - 8))}
        fill={color}
        fontSize="10"
        fontWeight="bold"
        opacity="0.7"
      >
        {curve.displayString}
      </text>
    </svg>
  )
}
