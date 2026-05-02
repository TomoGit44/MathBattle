/**
 * 非ゲーム画面 (ロビー / 待機 / GameOver) の Cyberpunk Math 背景。
 *
 * 全画面に固定で、CSS グラデで「グラフ電卓 LCD + TRON ネオン」感を出す。
 * 静的なので transform/opacity の制約は気にしなくて良いが、念のため
 * pointer-events-none + aria-hidden で視覚装飾に専念する。
 *
 * ゲーム画面の GameField とは別レイヤー (フィールドは独自の格子を持つ)。
 */
export const BackgroundGrid = () => {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* ベースの濃いインク色 */}
      <div className="absolute inset-0 bg-bg-deep" />
      {/* 中央に放射する微弱な cyan glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(56,189,248,0.10) 0%, transparent 65%)',
        }}
      />
      {/* グラフ用紙の格子 (cyan 微細) */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(56,189,248,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.18) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* 主格子 (8倍ピッチ) */}
      <div
        className="absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(56,189,248,0.30) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.30) 1px, transparent 1px)',
          backgroundSize: '160px 160px',
        }}
      />
      {/* 上下のフェード (端でグリッドが消える) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, var(--color-bg-deep) 0%, transparent 18%, transparent 82%, var(--color-bg-deep) 100%)',
        }}
      />
    </div>
  )
}
