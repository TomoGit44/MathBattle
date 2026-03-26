# CLAUDE.md — Math Battle Online

## プロジェクト概要
数字を弾として撃ち合う、デッキ構築型2Dターン制対戦ゲーム。
プレイヤーはデッキからカードを引き、「計算」で数字を合成し、「攻撃」で相手に数字の弾を飛ばす。
画面構成は2D格闘ゲーム風で、プレイヤーが左右に向かい合って戦う。

## 技術スタック
- **フロントエンド**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- **リアルタイム同期**: PartyKit (Cloudflare Workers上のWebSocketルーム)
- **データベース / 認証**: Supabase (PostgreSQL + Google OAuth)
- **言語**: TypeScript統一 (クライアントとサーバーで型を共有)

## プロジェクト構成
```
/
├── app/                       # Next.js App Router ページ
│   ├── page.tsx               # ランディング / ロビー
│   ├── deck-builder/          # デッキ構築画面
│   ├── game/[roomId]/         # ゲームルーム画面
│   └── ranking/               # ランキング画面
├── components/
│   ├── game/                  # ゲームUI (フィールド, HPバー, 手札, アクション選択)
│   ├── deck/                  # デッキ構築UI
│   └── ui/                    # 共通UIパーツ
├── lib/
│   ├── types.ts               # 共有型定義 (後述)
│   ├── deck.ts                # デッキ/カード定義、バリデーション
│   ├── calc-engine.ts         # カード計算ロジック (合成結果の算出)
│   ├── physics.ts             # 弾の移動、反射、衝突判定
│   ├── damage.ts              # ダメージ計算
│   └── supabase.ts            # Supabaseクライアント + 型付きクエリ
├── party/
│   └── index.ts               # PartyKitサーバー (ゲームのコアロジック)
├── hooks/
│   ├── useGameSocket.ts       # PartyKit WebSocketフック
│   └── useDeck.ts             # デッキ構築用状態管理
└── CLAUDE.md                  # このファイル
```

---

## ゲーム仕様

### カードシステム

**カードの種類:**
- **数字カード**: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
- **演算子カード**: +, -, ×, ÷ (将来的に累乗等を追加可能)

**デッキルール:**
- デッキはゲーム開始前に構築する
- デッキ枚数: 最小20枚 / 最大30枚 (要バランス調整)
- 同じカードの上限枚数は種類ごとに設定 (例: 数字カード各4枚まで、演算子各3枚まで)

**手札:**
- ターン開始時にデッキから数枚ドローする (初期案: 2枚)
- 手札上限: 7枚 (超過時はドロー不可 or 選んで捨てる)

### フィールド

画面構成は2D格闘ゲーム風:
- 横長のフィールドに2人のプレイヤーが左右に向かい合う
- フィールドには上下左右の壁がある
- フィールド上に弾 (数字) が飛び交う
- 各プレイヤーの上部にHPバーを表示

```
┌──────────────────────────────────────────┐
│  [HP: ████████░░]  P1        P2  [HP: ██████████] │
│                                          │
│    @-->          (5)-->    <--(12)   @   │
│                     (3)↗               │
│                                          │
└──────────────────────────────────────────┘
  [手札: 3, +, 7, 2]    [アクション選択]
```

### ターン進行

1. **ドローフェーズ** — 両者がデッキからカードを引く
2. **アクション選択フェーズ** — 両者が同時にアクションを1つ選ぶ (同時入力→サーバーで同時解決)
3. **解決フェーズ** — サーバーがアクションと弾の移動を処理し、結果をブロードキャスト
4. **ターン終了** — HP判定 → 次ターンへ or ゲームオーバー

### アクション (1ターンに1つ選択)

**移動:**
- 上下左右の4方向に一定距離だけ移動する
- フィールド端を超えることはできない

**計算:**
- 手札からカードを複数枚消費して、新しい数字を1つ作る
- 例: 手札の「3」「+」「7」を消費 → 手札に「10」が加わる
- 例: 「9」「×」「9」を消費 → 手札に「81」が加わる
- 計算結果が有効な数値でなければ失敗 (0除算など)
- 合成した数字は手札上の数値トークンとして保持される

**攻撃:**
- 手札の数字を1つ選んで、正面方向に弾として発射する
- 弾は手札から消費される

### 弾の挙動

**速度:**
- 弾の速度 = 基準速度 / (1 + 数字の大きさ × 減速係数)
- 小さい数字ほど速く、大きい数字ほど遅い
- 0の弾は最速だがダメージもほぼ0

**衝突 (弾 vs 弾):**
- 弾は味方弾と敵弾で区別する
- 味方弾同士は衝突しない (すり抜ける)
- 敵弾同士が衝突した場合: 大きい方の値 - 小さい方の値 = 残る弾の値
  - 残った弾は大きかった側の所有のまま進行する
  - 同値なら両方消滅する

**壁反射:**
- 弾がフィールドの壁に当たると反射する
- 反射するたびに弾の数字が大きくなる (例: +2 or ×1.5、要調整)
- 反射回数の上限を設ける (例: 3回で消滅)

**プレイヤーへのヒット:**
- 敵の弾がプレイヤーに当たると、弾の数字分のダメージを受ける
- ヒットした弾は消滅する

### 勝敗条件
- 初期HP: 100 (要調整)
- HPが0以下になったプレイヤーの負け
- 両者同時にHP0以下 → 引き分け
- デッキ切れの場合: 手札だけで続行 (ドローフェーズをスキップ)

---

## 主要な型定義 (lib/types.ts)

```ts
// --- カード ---
type NumberCard = { type: 'number'; value: number } // 0-9
type OperatorCard = { type: 'operator'; operator: '+' | '-' | '×' | '÷' }
type Card = NumberCard | OperatorCard

// 計算結果として手札に残る数値トークン
type NumberToken = { type: 'token'; value: number }

// 手札のアイテム (カードまたは合成済みトークン)
type HandItem = Card | NumberToken

// --- デッキ ---
interface Deck {
  id: string
  name: string
  cards: Card[] // 20~30枚
}

// --- フィールド ---
interface Position { x: number; y: number }

interface Bullet {
  id: string
  owner: string       // プレイヤーID
  value: number       // 弾の数字
  position: Position
  velocity: { dx: number; dy: number }
  reflections: number // 反射回数
}

// --- アクション ---
type Action =
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'calculate'; cardIndices: number[] }
  | { type: 'attack'; handIndex: number }

// --- プレイヤー ---
interface PlayerState {
  id: string
  name: string
  hp: number
  position: Position
  facing: 'left' | 'right'
  hand: HandItem[]
  deckRemaining: number // 相手には枚数だけ見せる
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
  fieldSize: { width: number; height: number }
}
```

---

## PartyKitサーバー (party/index.ts) の責務

サーバーが権威を持つ設計 (Server Authoritative)。

1. **onConnect**: プレイヤーのルーム参加 (最大2人)。デッキデータを受け取りサーバーに保持
2. **ドロー処理**: ターン開始時にサーバー側でデッキからカードを引き、各プレイヤーに手札を通知 (相手の手札の中身は送らない、枚数のみ)
3. **アクション受信**: 両者の入力を待つ (タイムアウト付き)
4. **解決処理**:
   - 移動: 座標更新 + フィールド端クランプ
   - 計算: カードを消費してトークン生成 (計算式のバリデーション)
   - 攻撃: 弾を生成、手札から消費
5. **弾の更新** (毎ターン):
   - 全弾を速度に応じて移動
   - 壁反射の判定 (数値増加 + 反射回数インクリメント)
   - 弾同士の衝突判定 (敵味方の区別)
   - プレイヤーへのヒット判定 → ダメージ適用
6. **勝敗判定**: HP <= 0 を検出 → gameover をブロードキャスト
7. **情報の非対称性**: 相手の手札の中身は隠す。見せるのは枚数と公開情報のみ

---

## コーディング規約
- `async/await` を使う。`.then()` チェーンは禁止
- コンポーネント: 名前付きエクスポート、1ファイル1コンポーネント
- スタイリングはTailwindのユーティリティクラスのみ (CSS Modules, styled-components 禁止)
- コンポーネントは `const` アロー関数: `export const Foo = () => { ... }`
- WebSocket切断/再接続を全接続コンポーネントで適切にハンドリングする
- ユーザー入力は必ずサーバー側でバリデーション (NaN, 範囲, 型)
- ネストした `if/else` より早期リターンを優先する
- `party/index.ts` は300行以内に抑え、ヘルパーは `lib/` に切り出す

## よく使うコマンド
```bash
npm run dev              # フロントエンド開発サーバー
npx partykit dev         # PartyKitサーバー (別ターミナル)
npx vercel --prod        # フロントエンドデプロイ
npx partykit deploy      # リアルタイムサーバーデプロイ
npx supabase db push     # マイグレーション適用
npx supabase gen types   # TypeScript型の再生成
```

## 環境変数
```
NEXT_PUBLIC_PARTYKIT_HOST=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # サーバー側専用
```

---

## バランス調整メモ (未確定)
- 弾の速度計算式の具体的な係数
- 壁反射時の数値増加量 (+固定値 vs ×倍率)
- 反射上限回数
- デッキ枚数の下限/上限
- 各カードの投入上限枚数
- 1ターンのドロー枚数
- 手札上限
- 初期HP
- 計算で使えるカード枚数の上限 (無制限だとワンターンキル可能)
- 移動距離
- プレイヤーと弾の当たり判定サイズ
