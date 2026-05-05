// WebSocket境界での JSON シリアライズ。
// JSON.stringify は Infinity / -Infinity を null に変換するため、
// ゲーム内の "無限" 値を保持できない。送受信時にセンチネル文字列に変換する。

const INF = '__INF__'
const NEG_INF = '__NEG_INF__'

export const encodeMessage = (msg: unknown): string =>
  JSON.stringify(msg, (_key, value) => {
    if (typeof value === 'number') {
      if (value === Infinity) return INF
      if (value === -Infinity) return NEG_INF
    }
    return value
  })

export const decodeMessage = <T>(data: string): T =>
  JSON.parse(data, (_key, value) => {
    if (value === INF) return Infinity
    if (value === NEG_INF) return -Infinity
    return value
  })
