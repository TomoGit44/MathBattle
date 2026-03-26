# Math Battle Online

数字を弾として撃ち合う、デッキ構築型2Dターン制対戦ゲーム。

## ゲーム概要

プレイヤーはデッキからカード (数字・演算子) を引き、「計算」で数字を合成し、「攻撃」で相手に数字の弾を飛ばします。画面構成は2D格闘ゲーム風で、弾の回避・合成・発射を繰り返しながら相手のHPを0にすれば勝利です。

### 基本ルール

| 項目 | 内容 |
|------|------|
| 対戦形式 | オンライン1vs1 |
| ターン制 | 同時入力 → 同時解決 |
| デッキ | 数字カード (0-9) と演算子カード (+, -, ×, ÷) で構築 |
| 手札 | ターン開始時にデッキから数枚ドロー |
| アクション | 1ターンに「移動」「計算」「攻撃」のいずれか1つ |
| HP | 100 (暫定) |

### アクション

- **移動** — 上下左右に一定距離移動して弾を回避する
- **計算** — 手札のカードを消費して新しい数字を合成する (例: 3 + 7 = 10)
- **攻撃** — 手札の数字を正面に弾として発射する

### 弾の特徴

- 大きい数字ほど高威力だが速度が遅い
- 敵弾同士が衝突すると、大きい方が差分だけ残る
- 壁に反射するたびに数字が大きくなる

## クイックスタート

### 必要なもの
- Node.js 20以上
- Supabaseアカウント (無料枠)
- PartyKitアカウント (無料枠)

### セットアップ

```bash
# クローン & インストール
git clone <repo-url>
cd math-battle
npm install

# 環境変数
cp .env.example .env.local
# Supabase と PartyKit の認証情報を記入

# データベースセットアップ
npx supabase db push

# 開発サーバー起動 (ターミナル2つ)
npm run dev              # Next.js → localhost:3000
npx partykit dev         # PartyKit → localhost:1999
```

ブラウザのタブを2つ開いて `http://localhost:3000` にアクセスすればローカルで対戦テストできます。

### デプロイ

```bash
npx vercel --prod        # フロントエンド → Vercel
npx partykit deploy      # リアルタイム → PartyKit (Cloudflare)
```

## アーキテクチャ

```
ブラウザ A ──WebSocket──┐
                        ├── PartyKit Room (エッジ) ── Supabase (DB + 認証)
ブラウザ B ──WebSocket──┘
```

- **フロントエンド**: Next.js 15, App Router, Tailwind CSS
- **リアルタイム同期**: PartyKit (Cloudflare Workers)
- **データベース & 認証**: Supabase (PostgreSQL + Google OAuth)

全ゲームロジックはPartyKitサーバー上で動作します (サーバー権威型)。クライアントは表示と入力のみ。

## プロジェクト構成

```
app/              → ページ (ロビー, デッキ構築, ゲームルーム, ランキング)
components/       → Reactコンポーネント
lib/              → 共有ロジック (カード, 計算, 物理演算, 型定義)
party/            → PartyKitサーバー (コアゲームループ)
hooks/            → カスタムReactフック
```

## 開発について

AI支援による個人開発プロジェクトです (Claude Code + Cursor)。
AIへのプロジェクトコンテキストは `CLAUDE.md` を参照してください。

## ライセンス

MIT
