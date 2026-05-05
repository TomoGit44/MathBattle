# CLAUDE.md — Math Battle Online

## プロジェクト概要
数字を弾として撃ち合う、デッキ構築型2Dターン制対戦ゲーム。
プレイヤーはデッキからカードを引き、「計算」で数字を合成し、「攻撃」で相手に数字の弾を飛ばす。
「関数」アクションでフィールドに数学的な曲線を描き、相手にダメージを与えることもできる。
画面構成は2D格闘ゲーム風で、プレイヤーが左右に向かい合って戦う。

## 技術スタック
- **フロントエンド**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- **リアルタイム同期**: カスタムWebSocketサーバー (`ws` パッケージ, `server/index.ts`)
  - ※ PartyKit は Windows のパスバグにより断念。`ws` で同等の機能を実装済み。
- **データベース / 認証**: 未実装 (将来: Supabase + Google OAuth)
- **言語**: TypeScript統一 (クライアントとサーバーで型を共有)

## プロジェクト構成
```
/
├── app/                         # Next.js App Router ページ
│   ├── page.tsx                 # ロビー (名前入力・ルーム作成/参加)
│   ├── game/[roomId]/           # ゲームルーム画面
│   ├── deck-builder/            # デッキ構築画面 (未実装)
│   └── ranking/                 # ランキング画面 (未実装)
├── components/
│   └── game/                    # ゲームUI
│       ├── GameScreen.tsx        # ゲーム全体レイアウト
│       ├── GameField.tsx         # フィールド描画 (弾・プレイヤー・曲線・軌跡)
│       ├── ActionPanel.tsx       # アクション選択UI (移動/計算/攻撃/関数)
│       ├── HandDisplay.tsx       # 手札カード表示
│       ├── HpBar.tsx             # HPバー
│       ├── Player.tsx            # プレイヤースプライト
│       ├── BulletDisplay.tsx     # 弾の描画
│       ├── TrajectoryTrail.tsx   # 弾の軌跡プレビュー (グラデーション)
│       ├── CurveDisplay.tsx      # 関数カーブのSVG描画
│       ├── FunctionPreview.tsx   # 関数式のライブプレビュー
│       ├── OpponentInfo.tsx      # 相手の公開情報 (手札枚数等)
│       ├── TurnResult.tsx        # ターン結果表示
│       └── GameOver.tsx          # ゲーム終了画面
├── lib/
│   ├── types.ts                 # 共有型定義 (後述)
│   ├── constants.ts             # ゲームバランス定数・デフォルトデッキ
│   ├── deck.ts                  # デッキシャッフル・ドロー処理
│   ├── calc-engine.ts           # カード計算ロジック (合成結果の算出)
│   ├── func-engine.ts           # 関数アクション (式の構築・評価・適用)
│   ├── physics.ts               # 弾の移動・反射・衝突判定
│   ├── damage.ts                # ダメージ計算・HP管理
│   ├── prime.ts                 # 素数判定 (素数弾の特殊衝突に使用)
│   ├── config.ts                # game-config.json の読み込み (サーバー専用)
│   ├── curve-collision.ts       # 曲線とプレイヤーの衝突判定
│   ├── coordinates.ts           # 数学座標 ↔ ピクセル座標の変換
│   ├── trajectory.ts            # クライアント側の弾軌跡予測
│   └── game-logic.ts            # ゲーム状態管理 (resolveActions 等)
├── server/
│   └── index.ts                 # WebSocketサーバー (ws) — ゲームのコアロジック
├── hooks/
│   └── useGameSocket.ts         # ネイティブWebSocketフック
├── party/
│   └── index.ts                 # PartyKit版サーバー (使用停止・参照用)
└── CLAUDE.md                    # このファイル
```

---

## ゲーム仕様

### 用語定義

- **数字カード**: 数字のカード全般。デッキから引かれる数字カード (`NumberCard`) と計算結果として生成される数値トークン (`NumberToken`) の両方を含む。
- **演算カード**: `+`, `-`, `×`, `÷` の演算子カード (`OperatorCard`)。
- **素数弾**: **値が10以上の素数**である弾 (例: 11, 13, 17, 19, 23, ...)。整数のみ素数判定対象 (小数は対象外)。判定は `lib/prime.ts` の `isPrimeBullet()`。

### カードシステム

**カードの種類:**
- **数字カード**: 0〜9 の整数 (デフォルトでは 1〜9 が手札補充で常時供給される)
- **演算カード**: `+`, `-`, `×`, `÷` (将来的に累乗等を追加可能)
- **数値トークン**: 計算アクションで生成される合成済み数値 (手札上に保持。これも数字カードに含まれる)

**デフォルトデッキ (7枚):**
- 演算カードのみ: `+`×2, `×`×2, `-`×1, `÷`×2 = 7枚
- 数字カードはデッキに入っておらず、手札補充ルールで自動供給される

**数字カード補充ルール:**
- ドローフェーズの最後に、手札中の数字カード (NumberCard + NumberToken) の枚数をカウント
- **2枚以下** (`NUMBER_REPLENISH_THRESHOLD`) なら、手札に **1〜9 の数字カードを各1枚追加**する
- 手札上限 (`MAX_HAND_SIZE = 16`) を超えない範囲で補充

**デッキルール:**
- デッキはゲーム開始前に構築する (未実装: デッキビルダー画面)
- デッキ枚数上限・同名カードの投入上限: 未確定

**手札:**
- ターン開始時にデッキから **2枚** ドローする
- 手札上限: **16枚** (超過時はドロー・補充をスキップ)
- 計算で使えるカード枚数の上限: **5枚** (`MAX_CALC_CARDS`)

### フィールド

- 論理サイズ: **800 × 400 px**
- 数学座標系: **x ∈ [-10, 10], y ∈ [-5, 5]**、中心 (0, 0) を原点とする
- フィールド中央に直交座標軸 (x軸・y軸) を薄く表示
- 横長のフィールドに2人のプレイヤーが左右に向かい合う
- フィールド上に弾・関数カーブが描かれる

```
┌──────────────────────────────────────────┐
│  [HP: ████████░░]  P1        P2  [HP: ██████████] │
│                    ·····y                │
│    @-->      x·····0·····  <--(12)   @   │
│           f(x)=x+1              ~~~~~    │
└──────────────────────────────────────────┘
  [手札: 3, +, 7, x]    [アクション選択]
```

### ターン進行

1. **ドローフェーズ** — 両者がデッキからカードを引く (サーバー側で処理)
2. **アクション選択フェーズ** — 両者が同時にアクションを1つ選ぶ (タイムアウト: 45秒)
3. **解決フェーズ** — サーバーがアクション・弾の移動・曲線ダメージを処理しブロードキャスト
4. **ターン結果表示** — アニメーション (3秒) でターンの出来事を表示
5. **ターン終了** — HP判定 → 次ターン (4秒後) or ゲームオーバー

### アクション (1ターンに1つ選択)

**移動:**
- 上下左右の4方向に **40px** だけ移動する
- フィールド端を超えることはできない

**計算:**
- 手札からカードを3〜5枚消費して、新しい数値トークンを1つ作る
- 式は **数値・演算子の交互パターン** (例: `3`, `+`, `7` → トークン `10`)
- 評価は通常の数学の優先順位 (× ÷ が + - より先、同優先度内は左→右): `1 + 2 × 3` → `7`、`2 + 4 ÷ 2` → `4`
- 計算失敗 (0除算、パターン違反) の場合は消費なし
- **計算は1ターンに何度でも実行できる** (移動/攻撃/関数とは異なり「ターンの主アクション」を消費しない)。サーバーが即時に計算を適用し、更新後の手札を返す。プレイヤーは続けて計算を重ねたあと、別アクション (移動/攻撃/関数) を確定して送信する
- **素数合成演出**: 計算結果が **10以上の素数** の場合、TurnResult 表示時に画面中央に大きな「PRIME!」テキストと値がフェードイン→フェードアウトで表示される。生成された数値トークンには手札上で持続的な紫〜青の素数オーラが表示される (`HandDisplay`)

**攻撃:**
- 手札の数字/トークンを1つ選んで、正面方向に弾として発射する
- 弾は手札から消費される

**関数:**
- 手札のカードと変数 `x` を組み合わせて数学的な式 `f(x)` を定義する
- 定義するとフィールド上に曲線が恒久的に描かれ、毎ターン判定される
- 曲線上に敵プレイヤーがいると **10ダメージ**/ターン
- 自分の曲線は自分にダメージを与えない
- **使用回数上限: 10回/プレイヤー** (ゲーム全体を通じて)
- 式の構成: 手札カードと `x` を **交互** に並べる (最小3要素、上限なし)
  - 例: `x × 2 + 1` → ターン毎に全敵に判定
  - 式の評価範囲: x ∈ [-10, 10]、y が [-5, 5] を超える区間は描画・判定なし
  - 評価順序は計算アクションと同じく通常の数学の優先順位 (× ÷ が + - より先、同優先度内は左→右)

### 弾の挙動

**速度:**
- `speed = 80 / (1 + value × 0.15)`
- 小さい数字ほど速く、大きい数字ほど遅い

**衝突 (弾 vs 弾):**
- 味方弾同士は衝突しない (すり抜ける)
- **素数弾 (値が10以上の素数) は特殊扱い**:
  - 素数弾 vs 通常弾: 通常弾は素数弾の値だけ削られる (≤0なら消滅)。素数弾は値も方向も変わらず**そのまま貫通**する
  - 素数弾 vs 素数弾: 互いに何も起きずに**そのまま貫通**する (すり抜け)
- 通常弾同士の衝突: 大きい方の値 - 小さい方の値 = 残る弾の値
  - 残った弾は大きかった側の所有のまま進行する
  - 同値なら両方消滅する

**壁反射:**
- 弾がフィールドの壁に当たると反射する
- 反射のたびに弾の数字が **+3** 増加する
- 反射上限: **3回** (超過で消滅)

**プレイヤーへのヒット:**
- 敵の弾がプレイヤーに当たると、弾の数字分のダメージを受ける (ヒット判定半径: 34px)
- ヒットした弾は消滅する

**軌跡プレビュー:**
- アクション選択フェーズ中、現在の弾が次のターン最終的にどこまで行くかを半透明グラデーションで表示する

### 勝敗条件
- 初期HP: **100**
- HPが0以下になったプレイヤーの負け
- 両者同時にHP0以下 → 引き分け
- デッキ切れの場合: 手札だけで続行 (ドローフェーズをスキップ)

---

## 主要な型定義 (lib/types.ts)

```ts
// --- カード ---
type NumberCard  = { type: 'number';   value: number }
type OperatorCard = { type: 'operator'; operator: '+' | '-' | '×' | '÷' }
type Card = NumberCard | OperatorCard

// 計算結果として手札に残る数値トークン
type NumberToken = { type: 'token'; value: number }

// 手札のアイテム (カードまたは合成済みトークン)
type HandItem = Card | NumberToken

// --- 関数の式の構成要素 ---
interface FunctionExpressionItem {
  type: 'number' | 'operator' | 'token' | 'variable'
  value?: number
  operator?: '+' | '-' | '×' | '÷'
}

// --- フィールド上の関数カーブ ---
interface FunctionCurve {
  id: string
  owner: string                    // プレイヤーID
  expression: FunctionExpressionItem[]
  displayString: string            // "f(x) = x×2+1"
}

// --- アクション ---
type Action =
  | { type: 'move';     direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'calculate'; cardIndices: number[] }
  | { type: 'attack';   handIndex: number }
  | { type: 'function'; cardIndices: number[]; xPositions: number[] }
  //   cardIndices: 使用するカードの手札インデックス (出現順)
  //   xPositions: 式全体の中で x が入る位置 (0-indexed)

// --- プレイヤー ---
interface PlayerState {
  id: string
  name: string
  hp: number
  position: Position
  facing: 'left' | 'right'
  hand: HandItem[]
  deckRemaining: number
  functionUsesRemaining: number    // 関数アクションの残り使用回数
}

// --- ゲーム ---
type GamePhase =
  | 'waiting'    // 対戦相手待ち
  | 'draw'       // ドローフェーズ
  | 'action'     // アクション選択 (同時入力)
  | 'resolving'  // サーバー処理中
  | 'result'     // ターン結果表示
  | 'gameover'   // 決着

interface GameState {
  phase: GamePhase
  turn: number
  players: Record<string, PlayerState>
  bullets: Bullet[]
  curves: FunctionCurve[]          // フィールド上の全関数カーブ (永続)
  fieldSize: { width: number; height: number }
}

// --- クライアントに送るゲーム状態 ---
interface ClientGameState {
  phase: GamePhase
  turn: number
  me: PlayerState
  opponent: SanitizedPlayerState   // 相手の手札内容は非公開
  bullets: Bullet[]
  curves: FunctionCurve[]
  fieldSize: { width: number; height: number }
  turnResult?: TurnResult
}

// --- ターン結果 ---
interface TurnResult {
  actions: Record<string, { type: string; description: string }>
  damages: Record<string, number>        // 弾ダメージ合計
  curveDamages: Record<string, number>   // 曲線ダメージ
  bulletEvents: string[]
  bulletSnapshots: BulletSnapshot[]      // 物理シミュレーションの各tick状態
  playerPositions: Record<string, Position>
}
```

---

## WebSocketサーバー (server/index.ts) の責務

サーバーが権威を持つ設計 (Server Authoritative)。

1. **接続処理**: プレイヤーのルーム参加 (最大2人)。`join` メッセージでデッキを受け取りサーバーに保持
2. **ドロー処理**: ターン開始時にサーバー側でデッキからカードを引き、各プレイヤーに手札を通知 (相手の手札の中身は送らない、枚数のみ)
3. **アクション受信**: 両者の入力を待つ (タイムアウト45秒、超過時はデフォルト行動)
   - **計算アクションは即時処理**: `pendingActions` には積まれず、サーバーが直接手札を更新して結果を返す。同一ターン中に何度でも計算可能
4. **解決処理** (`lib/game-logic.ts`):
   - 移動: 座標更新 + フィールド端クランプ
   - 計算: カードを消費してトークン生成 (計算式のバリデーション)
   - 攻撃: 弾を生成、手札から消費
   - 関数: 式をバリデーション・評価し `FunctionCurve` を生成、フィールドに追加
5. **弾の物理シミュレーション** (毎ターン10tick):
   - 全弾を速度に応じて移動 (`lib/physics.ts`)
   - 壁反射の判定 (数値 +3 · 反射回数インクリメント)
   - 弾同士の衝突判定 (敵味方の区別)
   - プレイヤーへのヒット判定 → ダメージ適用
6. **曲線ダメージ判定**: 全カーブをサンプリングし、敵プレイヤーが曲線上にいれば10ダメージ (`lib/curve-collision.ts`)
7. **勝敗判定**: HP <= 0 を検出 → gameover をブロードキャスト
8. **情報の非対称性**: 相手の手札の中身は隠す。見せるのは枚数・残り関数回数・座標のみ

---

## コーディング規約
- `async/await` を使う。`.then()` チェーンは禁止
- コンポーネント: 名前付きエクスポート、1ファイル1コンポーネント
- スタイリングはTailwindのユーティリティクラスのみ (CSS Modules, styled-components 禁止)
- コンポーネントは `const` アロー関数: `export const Foo = () => { ... }`
- WebSocket切断/再接続を全接続コンポーネントで適切にハンドリングする
- ユーザー入力は必ずサーバー側でバリデーション (NaN, 範囲, 型)
- ネストした `if/else` より早期リターンを優先する
- `server/index.ts` は300行以内に抑え、ヘルパーは `lib/` に切り出す

## よく使うコマンド
```bash
npm run dev              # フロントエンド開発サーバー (port 3000)
npx tsx server/index.ts  # WebSocketサーバー (port 1999, 別ターミナル)
npx next build           # プロダクションビルド確認
```

## 設定ファイル (`game-config.json`)

プロジェクトルートに `game-config.json` を置くことでゲームバランスを調整できる。
サーバー起動時に読み込まれる (変更にはサーバー再起動が必要)。
ファイルが無い・パース失敗時はデフォルト値が使われる。

```json
{
  "actionTimeoutSec": 45
}
```

| キー | デフォルト | 説明 |
|------|-----------|------|
| `actionTimeoutSec` | `45` | アクション選択フェーズのタイムアウト (秒)。**`0` 以下を指定すると時間制限なし** |

実装は `lib/config.ts`。サーバー (`server/index.ts`) が `loadConfig()` を起動時に1回呼ぶ。

## デプロイ

スマホで遊ぶための公開デプロイ手順は [`DEPLOYMENT.md`](./DEPLOYMENT.md) に記載。
- フロントエンド: **Vercel** (Next.js)
- WebSocketサーバー: **Render** (`server/index.ts` を `npm run start:server` で起動)
- 環境変数 `NEXT_PUBLIC_WS_URL` で Vercel ↔ Render を接続

## 環境変数
```
NEXT_PUBLIC_WS_URL=          # WebSocketサーバーのURL (例: wss://mathbattle-ws.onrender.com)
NEXT_PUBLIC_PARTYKIT_HOST=   # 後方互換 (host:port 形式、wssは自動付与)
# 以下は Supabase 統合時に追加予定
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
```

---

## バランス調整メモ

### 確定値
| 項目 | 値 | 定数名 |
|------|-----|--------|
| フィールドサイズ | 800 × 400 px | `FIELD_WIDTH`, `FIELD_HEIGHT` |
| 初期HP | 100 | `INITIAL_HP` |
| 移動距離 | 40 px/ターン | `MOVE_DISTANCE` |
| ドロー枚数 | 2枚/ターン | `DRAW_COUNT` |
| 手札上限 | 16枚 | `MAX_HAND_SIZE` |
| 数字補充の閾値 | 2枚以下で 1〜9 を追加 | `NUMBER_REPLENISH_THRESHOLD` |
| 計算使用カード上限 | 5枚 | `MAX_CALC_CARDS` |
| 弾の基準速度 | 80 px/tick | `BASE_BULLET_SPEED` |
| 弾の減速係数 | 0.15 | `SPEED_DECAY_FACTOR` |
| 壁反射の数値増加 | +3 | `WALL_REFLECTION_BONUS` |
| 反射回数上限 | 3回 | `MAX_REFLECTIONS` |
| 関数使用回数上限 | 10回/プレイヤー | `MAX_FUNCTION_USES` |
| 曲線ダメージ | 10/ターン | `FUNCTION_DAMAGE` |
| アクションタイムアウト | 45秒 | `ACTION_TIMEOUT_MS` |
| アニメーション時間 | 3秒 | `ANIMATION_DURATION_MS` |

### 未確定 (要調整)
- デッキ枚数の下限/上限 (現状バリデーションなし)
- 各カードの投入上限枚数 (現状バリデーションなし)
- 計算で使えるカード枚数の上限 (上限5枚だがワンターンキルのリスクあり)
- プレイヤーと弾の当たり判定サイズ (現状 PLAYER_SIZE=24 + BULLET_SIZE=10 = 34px)
- 曲線の衝突判定閾値 (現状 30px、曲線の傾きによって体感が変わる)
- 関数カーブの永続期間 (現状ゲーム終了まで無限に残る)
- デッキビルダー・ランキング画面の実装
- Supabase によるデータ永続化・認証の実装

## Design Charter(デザイン憲章)

### 美学方向(コミット済み)
**Cyberpunk Math:** TRON × グラフ電卓 × 渋谷 2050。
数字は武器であり、宙を走る光である。冷たく鋭く、しかし美しい。

### NEVER(絶対に避けるデフォルト)
- フォント: Inter, Roboto, Arial, Space Grotesk, system-ui
- 色: 紫グラデ on 白背景の "AI slop" パレット(`#7c3aed`, `#a855f7` の安易使用)
- レイアウト: ネストされたカード(カード in カード)、汎用ドロップシャドウ + 角丸 8px
- テキスト: グラデーション付き虹色文字、装飾過多
- モーション: linear イージング、`transition: all` の濫用
- アクセシビリティ: prefers-reduced-motion の無視

### COMMIT TO(目指す方向)
- 数字こそが主役 → 数字専用フォントは独立して選定し、UI フォントとは別
- 数学座標系 (x∈[-10,10], y∈[-5,5]) を視覚言語の中心に
- 弾・カード・関数カーブそれぞれに固有の「動きの言語」を持たせる
- 2D 格闘ゲームの HUD 文法 (HP バー、ヒットエフェクト、KO 演出)
- ターン解決の 3 秒間はシネマ時間として最大活用

### デザイントークン(全コードでこれを参照)
:root の値は `app/globals.css` または `src/styles/tokens.css` で一元管理。

### 制約(絶対遵守)
- 60 FPS 維持(計測可能・Performance パネルで確認)
- transform / opacity 以外のプロパティでアニメーションしない(GPU レイヤー維持)
- prefers-reduced-motion: reduce のとき、画面シェイク・点滅・スケール変化を無効化
- WCAG AA コントラスト
- タッチ対象 44×44pt 以上
- フィールド要素 (バレット・カーブ・プレイヤー) は WebSocket レイテンシ下でも視認可能