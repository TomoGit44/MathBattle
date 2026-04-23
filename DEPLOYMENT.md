# MathBattle デプロイ手順 (スマホ対応)

スマホで遊ぶための公開デプロイ手順です。
**フロントエンド (Vercel) と WebSocket サーバー (Render) を別々にデプロイ**します。

> 💡 なぜ分ける? Vercel は WebSocket の長時間接続をサポートしないため、
> ws サーバーは別ホスティング (Render) にデプロイする必要があります。

---

## 全体像

```
   📱 スマホ (Safari/Chrome)
          │
          │  ① HTTPSでページ取得
          ▼
   ┌──────────────────┐
   │  Vercel          │  ← Next.js フロントエンド
   │  mathbattle      │
   │  .vercel.app     │
   └──────────────────┘
          │
          │  ② WSS接続
          ▼
   ┌──────────────────┐
   │  Render          │  ← WebSocketサーバー
   │  mathbattle-ws   │     (server/index.ts)
   │  .onrender.com   │
   └──────────────────┘
```

---

## ステップ 1: GitHub にプッシュ

両プラットフォームとも GitHub 連携でデプロイするので、まずリポジトリを GitHub にプッシュします。

```bash
git init
git add .
git commit -m "initial commit"
gh repo create mathbattle --public --source=. --push
# または手動で GitHub にリポジトリ作成 → git push
```

---

## ステップ 2: WebSocket サーバーを Render にデプロイ

### 方法 A: Blueprint (推奨)

1. https://render.com にサインアップ (GitHub連携)
2. ダッシュボード → **「New +」 → 「Blueprint」**
3. リポジトリ `mathbattle` を選択
4. リポジトリルートの `render.yaml` が自動検出される → 「Apply」
5. 数分待つとデプロイ完了。URL が発行される (例: `https://mathbattle-ws.onrender.com`)
6. **この URL をメモ** (次のステップで使う)

### 方法 B: 手動 (Blueprintを使わない場合)

1. ダッシュボード → 「New +」 → 「Web Service」
2. リポジトリを選択
3. 設定:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:server`
   - **Plan**: Free
   - **Region**: Singapore (日本に近い)
4. 「Create Web Service」

### 動作確認

ブラウザで `https://mathbattle-ws.onrender.com` を開いて
`MathBattle WebSocket Server` と表示されればOK。

> ⚠️ **無料プランの注意**: 15分アクセスが無いとスリープし、
> 次のアクセスで起動に30秒～1分かかります。
> 常時稼働したい場合は有料プラン ($7/月～) または UptimeRobot 等で定期 ping。

---

## ステップ 3: フロントエンドを Vercel にデプロイ

1. https://vercel.com にサインアップ (GitHub連携)
2. ダッシュボード → **「Add New」 → 「Project」**
3. リポジトリ `mathbattle` を「Import」
4. **Configure Project** 画面で **「Environment Variables」** を展開:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_WS_URL` | `wss://mathbattle-ws.onrender.com` |

   ⚠️ `https://` ではなく **`wss://`** (WebSocket Secure) を指定すること。
   末尾スラッシュは不要。

5. 「Deploy」をクリック
6. 数分でデプロイ完了。`https://mathbattle.vercel.app` のような URL が発行される

---

## ステップ 4: スマホでアクセス

1. iPhone/Android のブラウザで Vercel の URL を開く
2. 「ルームを作成」→ ルーム ID をメモ
3. もう1台のスマホ or PC で同じ URL を開き、ルーム ID を入力して「参加」
4. 対戦開始！

### ホーム画面に追加 (ショートカット化)

- **iOS Safari**: 共有ボタン → 「ホーム画面に追加」
- **Android Chrome**: メニュー → 「ホーム画面に追加」

これでネイティブアプリ風に起動できます。

---

## トラブルシューティング

### 「ルームに接続できません」

- Vercel の環境変数 `NEXT_PUBLIC_WS_URL` が正しく `wss://` で始まっているか確認
- 環境変数を変更したら Vercel で **再デプロイ** が必要 (Deployments → ⋯ → Redeploy)
- Render のサービスが起動しているか確認 (スリープしていれば1分ほど待つ)

### iPhone で画面が拡大されてしまう

- `app/layout.tsx` の viewport 設定で `userScalable: false` を指定済み
- それでも発生する場合は Safari のリーダー表示等が干渉している可能性あり

### Renderの無料枠でスリープがつらい

- 有料プラン ($7/月) にアップグレード、または
- [UptimeRobot](https://uptimerobot.com/) で5分ごとに `/` を監視 (実質スリープ防止)

### ローカル開発に戻したい

`.env.local` (gitignore済) を作成:
```
# 空のままにすれば localhost:1999 にフォールバック
```
あるいは `NEXT_PUBLIC_WS_URL=ws://localhost:1999` を指定。

---

## 設定値の調整 (デプロイ後)

`game-config.json` でターン入力時間などを調整できます。

```json
{
  "actionTimeoutSec": 60
}
```

変更後は `git push` → Render が自動再デプロイします。
