// プロジェクトルートの game-config.json を読み込み、デッキ構築 UI が必要な
// 設定値だけをクライアントへ公開する。WebSocket サーバーと同じファイルを参照するため、
// サーバー権威の制限値とロビー UI の表示・検証が一致する。
import { NextResponse } from 'next/server'
import { loadConfig, toGameSettings } from '@/lib/config'

export const dynamic = 'force-dynamic'

export const GET = async () => {
  try {
    const cfg = loadConfig()
    const s = toGameSettings(cfg)
    return NextResponse.json({
      drawCount: s.drawCount,
      maxHandSize: s.maxHandSize,
      minDeckSize: s.minDeckSize,
      maxDeckSize: s.maxDeckSize,
    })
  } catch {
    return NextResponse.json({ error: 'config_load_failed' }, { status: 500 })
  }
}
