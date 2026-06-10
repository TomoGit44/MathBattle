import { ImageResponse } from 'next/og'

// Next.js 15 の規約: app/opengraph-image.tsx を置くと自動的に
// /opengraph-image にOGP画像が生成され、メタタグも自動付与される。
// https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image

export const runtime = 'edge'

export const alt = 'Math Battle - 数字を弾として撃ち合うオンライン対戦ゲーム'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const OpengraphImage = async () => {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(ellipse at top, #1e293b 0%, #050714 60%, #000000 100%)',
          position: 'relative',
        }}
      >
        {/* 背景の数式パターン */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexWrap: 'wrap',
            opacity: 0.08,
            fontSize: 60,
            color: '#38bdf8',
            fontFamily: 'monospace',
            padding: 20,
            gap: 40,
          }}
        >
          <div>7 × 11 = 77</div>
          <div>√169 = 13</div>
          <div>2³ = 8</div>
          <div>π ≈ 3.14</div>
          <div>f(x) = x²</div>
          <div>9 + 4 = 13</div>
          <div>17 ÷ 17</div>
          <div>5! = 120</div>
        </div>

        {/* メインタイトル */}
        <div
          style={{
            display: 'flex',
            fontSize: 130,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: -3,
            textShadow: '0 0 40px rgba(56, 189, 248, 0.6)',
            marginBottom: 10,
            zIndex: 1,
          }}
        >
          Math Battle
        </div>

        {/* 数式風サブタイトル */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            fontSize: 42,
            color: '#fb7185',
            fontFamily: 'monospace',
            zIndex: 1,
            marginBottom: 30,
          }}
        >
          <span style={{ color: '#38bdf8' }}>3</span>
          <span style={{ color: '#94a3b8' }}>+</span>
          <span style={{ color: '#38bdf8' }}>7</span>
          <span style={{ color: '#94a3b8' }}>→</span>
          <span style={{ color: '#fbbf24', fontSize: 56 }}>10</span>
          <span style={{ color: '#94a3b8' }}>→</span>
          <span style={{ color: '#fb7185', fontSize: 56 }}>🎯</span>
        </div>

        {/* キャッチコピー */}
        <div
          style={{
            display: 'flex',
            fontSize: 38,
            color: '#e2e8f0',
            fontWeight: 600,
            zIndex: 1,
          }}
        >
          数字を弾として撃ち合え!
        </div>

        {/* フッター */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            display: 'flex',
            gap: 20,
            fontSize: 24,
            color: '#64748b',
            zIndex: 1,
          }}
        >
          <span>オンライン 1vs1</span>
          <span>•</span>
          <span>ブラウザで遊べる</span>
          <span>•</span>
          <span>無料</span>
        </div>
      </div>
    ),
    { ...size }
  )
}

export default OpengraphImage
