# CLAUDE.md — Math Battle Online

## プロジェクト概要
数字を弾として撃ち合う、デッキ構築型2Dターン制対戦ゲーム。
プレイヤーはデッキからカードを引き、「計算」で数字を合成し、「攻撃」で相手に数字の弾を飛ばす。
「関数」アクションでフィールドに数学的な曲線を描き、相手にダメージを与えることもできる。
フィールド上には演算子カードや回復を獲得できるアイテムが時折出現し、撃破または接触で拾得できる。
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
│   ├── page.tsx                 # ロビー (名前入力・デッキ構築・ルーム作成/参加)
│   ├── layout.tsx               # ルートレイアウト
│   ├── globals.css              # グローバルスタイル + デザイントークン
│   └── game/[roomId]/           # ゲームルーム画面
├── components/
│   ├── lobby/
│   │   └── DeckBuilder.tsx      # デッキ構築UI (ロビー画面に統合)
│   └── game/                    # ゲームUI
│       ├── GameScreen.tsx        # ゲーム全体レイアウト
│       ├── GameField.tsx         # フィールド描画 (弾・プレイヤー・曲線・軌跡・アイテム)
│       ├── BackgroundGrid.tsx    # 背景グリッド (数学座標)
│       ├── ActionPanel.tsx       # アクション選択UI
│       ├── HandDisplay.tsx       # 手札カード表示
│       ├── HpBar.tsx             # HPバー
│       ├── LowHpVignette.tsx     # 低HP時の画面演出
│       ├── Player.tsx            # プレイヤースプライト
│       ├── BulletDisplay.tsx     # 弾の描画
│       ├── TrajectoryTrail.tsx   # 弾の軌跡プレビュー
│       ├── CurveDisplay.tsx      # 関数カーブのSVG描画
│       ├── FunctionPreview.tsx   # 関数式のライブプレビュー
│       ├── ItemDisplay.tsx       # フィールド上アイテムの描画
│       ├── PrimeAura.tsx         # 素数トークンのオーラ演出
│       ├── CollisionEquation.tsx # 弾衝突時の式表示
│       ├── DamageFlash.tsx       # 被ダメージ時の画面フラッシュ
│       ├── DamagePop.tsx         # ダメージ数値ポップ
│       ├── ScreenShake.tsx       # 画面シェイクラッパー
│       ├── DetailTooltip.tsx     # ツールチップ
│       ├── ActionLog.tsx         # アクションログ
│       ├── OpponentInfo.tsx      # 相手の公開情報 (手札枚数等)
│       ├── TurnResult.tsx        # ターン結果表示
│       └── GameOver.tsx          # ゲーム終了画面
├── lib/
│   ├── types.ts                 # 共有型定義 (後述)
│   ├── constants.ts             # ゲームバランス定数・デフォルトデッキ
│   ├── deck.ts                  # デッキ構築・シャッフル・ドロー処理・バリデーション
│   ├── calc-engine.ts           # カード計算ロジック (合成結果の算出)
│   ├── func-engine.ts           # 関数アクション (式の構築・評価・適用)
│   ├── physics.ts               # 弾の移動・反射・衝突判定 (矩形含む)
│   ├── damage.ts                # ダメージ計算・HP管理
│   ├── prime.ts                 # 素数判定 (素数弾の特殊衝突に使用)
│   ├── items.ts                 # アイテムのスポーン・撃破・接触拾得・効果適用
│   ├── effects.ts               # ビジュアルエフェクト用シングルトンストア (shake/flash 等)
│   ├── config.ts                # game-config.json の読み込み (サーバー専用)
│   ├── curve-collision.ts       # 曲線とプレイヤー/曲線同士の衝突判定
│   ├── coordinates.ts           # 数学座標 ↔ ピクセル座標の変換
│   ├── trajectory.ts            # クライアント側の弾軌跡予測
│   ├── json-codec.ts            # WebSocket境界の Infinity セーフ JSON
│   └── game-logic.ts            # ゲーム状態管理 (resolveActions / executeDraw / applyImmediateMove)
├── server/
│   └── index.ts                 # WebSocketサーバー (ws) — 接続管理 + ゲーム進行
├── hooks/
│   └── useGameSocket.ts         # ネイティブWebSocketフック
├── party/
│   └── index.ts                 # PartyKit版サーバー (使用停止・参照用)
├── render.yaml                  # Render Blueprint (ws サーバーのデプロイ設定)
├── game-config.json             # サーバー側の動的バランス設定 (任意)
├── DEPLOYMENT.md                # Vercel + Render デプロイ手順
└── CLAUDE.md                    # このファイル
```

---

## ゲーム仕様

### 用語定義

- **数字カード**: 数字のカード全般。デッキから引かれる数字カード (`NumberCard`) と計算結果として生成される数値トークン (`NumberToken`) の両方を含む。
- **演算カード**: `+`, `-`, `×`, `÷` の演算子カード (`OperatorCard`)。
- **移動カード**: `↑`/`↓`/`←`/`→` の方向ごとに分かれたカード (`MoveCard`)。手札から消費して即時に1方向40px動く。
- **素数弾**: **値が10以上の素数**である弾 (例: 11, 13, 17, 19, 23, ...)。整数のみ素数判定対象 (小数は対象外)。判定は `lib/prime.ts` の `isPrimeBullet()`。
- **アイテム**: フィールド上にスポーンする獲得可能オブジェクト (`FieldItem`)。種別は `+`/`-`/`×`/`÷`/`pack`/`heal`。

### カードシステム

**カードの種類:**
- **数字カード**: 0〜9 の整数 (デフォルトでは 1〜9 が手札補充で常時供給される)
- **演算カード**: `+`, `-`, `×`, `÷`
- **移動カード**: 上下左右の4方向。1枚ごとに方向が固定
- **数値トークン**: 計算アクションで生成される合成済み数値 (手札上に保持。これも数字カード扱い)

**デフォルトデッキ (7枚):**
- 演算カードのみ: `+`×2, `×`×2, `-`×1, `÷`×2 = 7枚
- 数字カード・移動カードはデッキに入っておらず、手札補充ルールで自動供給される

**数字カード補充ルール:**
- ドローフェーズの最後に、手札中の数字カード (NumberCard + NumberToken) の枚数をカウント
- **3枚以下** (`NUMBER_REPLENISH_THRESHOLD`) なら、手札に **1〜9 の数字カードを各1枚追加**する
- 手札上限 (`MAX_HAND_SIZE = 16`) を超えない範囲で補充

**移動カード補充ルール:**
- ターン開始時、`MOVE_AUTO_REPLENISH = true` のとき、各方向 (↑↓←→) について手札に存在しなければ1枚ずつ補充
- これにより最低限の移動手段が常に確保される

**デッキルール (バリデーション済):**
- 最小枚数: **5枚** (`MIN_DECK_SIZE`)
- 最大枚数: **20枚** (`MAX_DECK_SIZE`)
- 同名カードの投入上限: **6枚** (`MAX_SAME_CARD_COUNT`)
- ロビー画面 (`app/page.tsx` + `components/lobby/DeckBuilder.tsx`) で構築。`localStorage` に永続化される

**手札:**
- ターン開始時にデッキから **2枚** ドローする (`DRAW_COUNT`)
- 手札上限: **16枚** (超過時はドロー・補充をスキップ)
- 計算で使えるカード枚数の上限: **5枚** (`MAX_CALC_CARDS`)

### フィールド

- 論理サイズ: **800 × 400 px**
- 数学座標系: **x ∈ [-10, 10], y ∈ [-5, 5]**、中心 (0, 0) を原点とする
- フィールド中央に直交座標軸 (x軸・y軸) を薄く表示
- グリッド線は数学座標で **0.5単位ごと** に描画 (`GRID_SPACING_X/Y = 0.5`)
- 横長のフィールドに2人のプレイヤーが左右に向かい合う
- フィールド上に弾・関数カーブ・アイテムが描かれる

```
┌──────────────────────────────────────────┐
│  [HP: ████████░░]  P1        P2  [HP: ██████████] │
│                    ·····y                │
│    @-->      x····[+]····  <--(12)   @   │
│           f(x)=x+1              ~~~~~    │
└──────────────────────────────────────────┘
  [手札: 3, +, 7, x, ↑]    [アクション選択]
```

### ターン進行

1. **ドローフェーズ** — サーバー側で各プレイヤーがデッキから2枚ドロー → 数字補充 → 移動補充 → アイテム抽選
2. **アクション選択フェーズ** — 両者が同時に「メインアクション」を1つ選ぶ (タイムアウト45秒、`game-config.json` で変更可)
   - 移動カード使用・計算は **このフェーズ中に何度でも即時実行可能** (メインアクションを消費しない)
3. **解決フェーズ** — サーバーがメインアクション・弾の物理シミュレーション・曲線ダメージを処理しブロードキャスト
4. **ターン結果表示** — アニメーション (3秒) でターンの出来事を表示
5. **ターン終了** — HP判定 → 次ターン (4秒後) or ゲームオーバー

### アクション

アクションは「**即時アクション**」と「**メインアクション**」に分かれる。
即時アクションはアクション選択フェーズ中に何度でも実行できる。メインアクションは1ターンに1つだけ選んで送信する。

#### 即時アクション (回数制限なし)

**移動カード使用 (`use_move_card`):**
- 手札から移動カードを1枚消費し、対応する方向に **40px** 移動する
- フィールド端を超えることはできない
- 即時に手札から消費され、サーバーは本人にだけ更新後の状態を返す (相手側からは移動が秘匿される)

**計算 (`calculate`):**
- 手札からカードを3〜5枚消費して、新しい数値トークンを1つ作る
- 式は **数値・演算子の交互パターン** (例: `3`, `+`, `7` → トークン `10`)
- 評価は通常の数学の優先順位 (× ÷ が + - より先、同優先度内は左→右): `1 + 2 × 3` → `7`、`2 + 4 ÷ 2` → `4`
- 計算失敗 (0除算、パターン違反) の場合は消費なし
- **素数合成演出**: 計算結果が **10以上の素数** の場合、画面中央に「PRIME!」テキストと値がフェードイン→フェードアウトで表示される。生成された数値トークンには手札上で持続的な紫〜青の素数オーラが表示される (`HandDisplay` / `PrimeAura`)

#### メインアクション (1ターンに1つ・送信でターン解決へ)

**攻撃 (`attack`):**
- 手札の数字/トークンを1つ選んで、正面方向に弾として発射する
- 弾は手札から消費される

**関数 (`function`):**
- 手札のカードと変数 `x` を組み合わせて数学的な式 `f(x)` を定義する
- 定義するとフィールド上に曲線が恒久的に描かれ、毎ターン判定される
- 曲線上に敵プレイヤーがいると **10ダメージ**/ターン (`FUNCTION_DAMAGE`)
- 自分の曲線は自分にダメージを与えない
- **使用回数上限: 10回/プレイヤー** (`MAX_FUNCTION_USES`、ゲーム全体を通じて)
- 式の構成: 手札カードと `x` を **交互** に並べる (最小3要素、上限なし)
  - 式の評価範囲: x ∈ [-10, 10]、y が [-5, 5] を超える区間は描画・判定なし
  - 評価順序は計算アクションと同じ通常の優先順位
- カーブ同士の打ち消し合い等のイベントは `TurnResult.curveEvents` に記録される

**スキップ (`skip`):**
- メインアクションを行わない
- アクションタイムアウト時は自動的にこれが入る

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
- 反射のたびに弾の数字が **+3** 増加する (`WALL_REFLECTION_BONUS`)
- 反射上限: **3回** (`MAX_REFLECTIONS`、超過で消滅)

**プレイヤーへのヒット:**
- 敵の弾がプレイヤーに当たると、弾の数字分のダメージを受ける (ヒット判定半径: 34px = `PLAYER_SIZE 24` + `BULLET_SIZE 10`)
- ヒットした弾は消滅する

**軌跡プレビュー:**
- アクション選択フェーズ中、現在の弾が次のターン最終的にどこまで行くかを半透明グラデーションで表示する

### アイテムシステム

フィールド上にスポーンする静止オブジェクト。両プレイヤーが弾で攻撃可能で、最後にHPを0にした側が報酬を獲得する。
プレイヤーが触れた場合も即時に拾得できる。

**種別 (`ItemKind`):**
| 種別 | 効果 |
|------|------|
| `+` `-` `×` `÷` | 対応する演算子カード1枚を手札に追加 |
| `pack` | 演算子4種 (+, -, ×, ÷) を一括で手札に追加 (空きが足りなければ入る分だけ) |
| `heal` | HP を `[healAmountMin, healAmountMax]` の乱数だけ回復 (上限は初期HP) |

**スポーン:**
- 毎ターン開始時に種別ごとの絶対確率で抽選 (`DEFAULT_ITEM_SPAWN_RATES`)
- 同時存在上限: **5個** (`MAX_ITEMS`)
- 出現範囲: 画面左右中央の ±100px (`ITEM_SPAWN_X_HALF_WIDTH`)
- 当たり判定: 直径40px の角丸矩形 (`ITEM_SIZE`, `ITEM_CORNER_RADIUS`)
- HP: `[ITEM_HP_MIN, ITEM_HP_MAX] = [1, 50]` の乱数

**獲得:**
- 撃破 (HPを0にする): 最後にダメージを与えた側が獲得 → `TurnResult.itemKills` に記録
- 接触 (移動アクションで触れる): 触れた側が獲得 → `TurnResult.itemPickups` に記録
- `awardedCount`: 実際に手札に追加できた枚数 (手札満杯時は0)

実装は [lib/items.ts](lib/items.ts)。スポーン確率・回復量は `GameSettings` 経由でサーバー権威。

### 勝敗条件
- 初期HP: **50** (`INITIAL_HP`)
- HPが0以下になったプレイヤーの負け
- 両者同時にHP0以下 → 引き分け
- デッキ切れの場合: 手札だけで続行 (ドローフェーズはスキップ)

---

## 主要な型定義 (lib/types.ts)

```ts
// --- カード ---
type Direction = 'up' | 'down' | 'left' | 'right'
type NumberCard   = { type: 'number';   value: number }
type OperatorCard = { type: 'operator'; operator: '+' | '-' | '×' | '÷' }
type MoveCard     = { type: 'move';     direction: Direction }
type Card = NumberCard | OperatorCard | MoveCard

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
  owner: string
  expression: FunctionExpressionItem[]
  displayString: string                  // "f(x) = 3×x+1"
}

// --- フィールド上のアイテム ---
type ItemKind = '+' | '-' | '×' | '÷' | 'pack' | 'heal'
interface FieldItem {
  id: string
  kind: ItemKind
  position: Position
  hp: number
  maxHp: number
  size: number                           // 当たり判定の直径 (px)
}

// --- アクション ---
// use_move_card / calculate は即時適用 (回数制限なし)
// attack / function / skip は「メインアクション」で、両プレイヤーが submit するとターンが解決される
type Action =
  | { type: 'use_move_card'; handIndex: number }
  | { type: 'calculate';     cardIndices: number[] }
  | { type: 'attack';        handIndex: number }
  | { type: 'function';      cardIndices: number[]; xPositions: number[] }
  | { type: 'skip' }

// --- プレイヤー ---
interface PlayerState {
  id: string
  name: string
  hp: number
  position: Position
  facing: 'left' | 'right'
  hand: HandItem[]
  deckRemaining: number
  functionUsesRemaining: number
}

// --- ゲーム ---
type GamePhase = 'waiting' | 'draw' | 'action' | 'resolving' | 'result' | 'gameover'

// サーバー権威の動的設定 (起動時に game-config.json から構築)
interface GameSettings {
  bulletRadius: number
  playerRadius: number
  moveDistance: number
  wallReflectionBonus: number
  mathXMax: number
  mathYMax: number
  pixelsPerUnit: number
  itemSize: number
  itemSpawnRates: Record<ItemKind, number>
  maxItems: number
  healAmountMin: number
  healAmountMax: number
}

interface GameState {
  phase: GamePhase
  turn: number
  players: Record<string, PlayerState>
  bullets: Bullet[]
  curves: FunctionCurve[]                // 永続。ゲーム終了まで残る
  items: FieldItem[]
  fieldSize: { width: number; height: number }
  settings: GameSettings
}

// --- クライアントに送るゲーム状態 ---
interface ClientGameState {
  phase: GamePhase
  turn: number
  me: PlayerState
  opponent: SanitizedPlayerState         // 相手の手札内容は非公開 (枚数のみ)
  bullets: Bullet[]
  curves: FunctionCurve[]
  items: FieldItem[]
  fieldSize: { width: number; height: number }
  settings: GameSettings
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
  curveEvents?: string[]                 // カーブ同士の打ち消し等
  primeSynthesis?: Record<string, number>
  itemKills?: Array<{ itemId; kind; killerId; awardedCount }>
  itemPickups?: Array<{ itemId; kind; pickerId; awardedCount }>
}
```

---

## WebSocketサーバー (server/index.ts) の責務

サーバーが権威を持つ設計 (Server Authoritative)。

1. **接続処理**: プレイヤーのルーム参加 (最大2人)。`join` メッセージでデッキを受け取り `sanitizeDeck()` で正規化して保持
2. **ハートビート**: 30秒ごとに ping → pong が返らない接続は terminate (ホスティング側 LB のアイドル切断対策)
3. **ドロー処理**: ターン開始時にデッキからカードを引き、数字補充・移動補充・アイテム抽選を行う。相手の手札の中身は送らず枚数のみ
4. **即時アクション処理** (アクション選択フェーズ中、何度でも):
   - **移動カード使用 (`use_move_card`)**: 手札から該当カードを消費して即時移動。本人にだけ新しい状態を返す (相手には移動を秘匿、`turnStartPositions` で位置を上書き)
   - **計算 (`calculate`)**: 手札を更新して即時送信。素数合成検出時は `primeSynthesis` イベントを TurnResult として送る
5. **メインアクション受信**: `attack` / `function` / `skip` を待つ (タイムアウト時は `skip` 自動投入)
6. **解決処理** (`lib/game-logic.ts` の `resolveActions`):
   - 攻撃: 弾を生成、手札から消費
   - 関数: 式をバリデーション・評価し `FunctionCurve` を生成、フィールドに追加
7. **弾の物理シミュレーション** (毎ターン10tick = `PHYSICS_TICKS_PER_TURN`):
   - 全弾を速度に応じて移動 (`lib/physics.ts`)
   - 壁反射の判定 (数値 +3 · 反射回数インクリメント)
   - 弾同士の衝突判定 (素数弾は特殊)
   - プレイヤー / アイテム矩形へのヒット判定 → ダメージ適用・アイテム撃破処理
8. **曲線ダメージ判定**: 全カーブをサンプリングし、敵プレイヤーが曲線上にいれば10ダメージ (`lib/curve-collision.ts`)
9. **アイテム接触拾得**: 移動で踏んだ瞬間に拾得し、TurnResult までバッファ (`pendingItemPickups`)
10. **勝敗判定**: HP <= 0 を検出 → gameover をブロードキャスト
11. **情報の非対称性**: 相手の手札の中身・移動カードによる即時移動は秘匿。見せるのは枚数・残り関数回数・ターン開始位置・公開済みのフィールド要素のみ

**JSON境界:** WebSocket メッセージは `lib/json-codec.ts` の `encodeMessage`/`decodeMessage` 経由で送受信する。`Infinity`/`-Infinity` をセンチネル文字列で保持する目的 (関数評価の発散値などを保持するため)。

---

## コーディング規約
- `async/await` を使う。`.then()` チェーンは禁止
- コンポーネント: 名前付きエクスポート、1ファイル1コンポーネント
- スタイリングはTailwindのユーティリティクラスのみ (CSS Modules, styled-components 禁止)
- コンポーネントは `const` アロー関数: `export const Foo = () => { ... }`
- WebSocket切断/再接続を全接続コンポーネントで適切にハンドリングする
- ユーザー入力は必ずサーバー側でバリデーション (NaN, 範囲, 型)
- ネストした `if/else` より早期リターンを優先する
- `server/index.ts` は500行以内を目安に、重いロジック (計算・物理・勝敗判定など) は `lib/` に切り出す。WebSocket bootstrap や接続管理 (heartbeat, ws イベントハンドラ) はサーバー側に残してよい

## よく使うコマンド
```bash
npm run dev              # フロントエンド開発サーバー (port 3000)
npm run server           # WebSocketサーバー (port 1999, 別ターミナル)
npm run dev:all          # 上記2つを concurrently で同時起動
npm run build            # プロダクションビルド確認
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

実装は `lib/config.ts`。サーバー (`server/index.ts`) が `loadConfig()` を起動時に1回呼び、同時に `toGameSettings()` で `GameSettings` を構築する。

## デプロイ

スマホで遊ぶための公開デプロイ手順は [`DEPLOYMENT.md`](./DEPLOYMENT.md) に記載。
- フロントエンド: **Vercel** (Next.js)
- WebSocketサーバー: **Render** (`server/index.ts` を `npm run start:server` で起動)
- 環境変数 `NEXT_PUBLIC_WS_URL` で Vercel ↔ Render を接続
- Render Blueprint (`render.yaml`) によりリポジトリから自動デプロイ可能

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
| 初期HP | 50 | `INITIAL_HP` |
| 移動距離 | 40 px/ターン | `MOVE_DISTANCE` |
| ドロー枚数 | 2枚/ターン | `DRAW_COUNT` |
| 手札上限 | 16枚 | `MAX_HAND_SIZE` |
| 数字補充の閾値 | 3枚以下で 1〜9 を追加 | `NUMBER_REPLENISH_THRESHOLD` |
| 移動カード自動補充 | 各方向不足分を毎ターン補充 | `MOVE_AUTO_REPLENISH` |
| 計算使用カード上限 | 5枚 | `MAX_CALC_CARDS` |
| デッキ最小/最大枚数 | 5 / 20 | `MIN_DECK_SIZE`, `MAX_DECK_SIZE` |
| 同名カード投入上限 | 6枚 | `MAX_SAME_CARD_COUNT` |
| 弾の基準速度 | 80 px/tick | `BASE_BULLET_SPEED` |
| 弾の減速係数 | 0.15 | `SPEED_DECAY_FACTOR` |
| 壁反射の数値増加 | +3 | `WALL_REFLECTION_BONUS` |
| 反射回数上限 | 3回 | `MAX_REFLECTIONS` |
| 物理 tick / ターン | 10 | `PHYSICS_TICKS_PER_TURN` |
| 関数使用回数上限 | 10回/プレイヤー | `MAX_FUNCTION_USES` |
| 曲線ダメージ | 10/ターン | `FUNCTION_DAMAGE` |
| 曲線サンプル数 | 200 | `CURVE_SAMPLE_COUNT` |
| 曲線衝突閾値 | 30 px | `CURVE_COLLISION_THRESHOLD` |
| アイテム同時上限 | 5個 | `MAX_ITEMS` |
| アイテム HP 範囲 | 1〜50 | `ITEM_HP_MIN`, `ITEM_HP_MAX` |
| アイテム回復量範囲 | 5〜20 | `DEFAULT_HEAL_AMOUNT_MIN/MAX` |
| アクションタイムアウト | 45秒 | `ACTION_TIMEOUT_MS` |
| アニメーション時間 | 3秒 | `ANIMATION_DURATION_MS` |
| ターン間ディレイ | 4秒 | `TURN_DELAY_MS` |
| グリッド間隔 | 0.5 数学単位 | `GRID_SPACING_X/Y` |

### 未確定 (要調整)
- 計算で使えるカード枚数の上限 (上限5枚だがワンターンキルのリスクあり)
- 曲線の衝突判定閾値 (現状 30px、曲線の傾きによって体感が変わる)
- 関数カーブの永続期間 (現状ゲーム終了まで無限に残る)
- アイテムスポーン確率の最終バランス (`DEFAULT_ITEM_SPAWN_RATES`)
- ランキング画面の実装
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
- フィールド要素 (バレット・カーブ・プレイヤー・アイテム) は WebSocket レイテンシ下でも視認可能
