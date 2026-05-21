# CLAUDE.md — Math Battle Online

## プロジェクト概要
数字を弾として撃ち合う 2Dターン制対戦ゲーム。
毎ターン共通プールからランダムに補充されるカードで、「計算」で数字を合成し、「攻撃」で相手に数字の弾を飛ばす。
「関数」アクションでフィールドに数学的な曲線を描き、相手にダメージを与えることもできる。
フィールド上には演算子カードや回復を獲得できるアイテムが時折出現し、撃破または接触で拾得できる。
画面構成は2D格闘ゲーム風で、プレイヤーが左右に向かい合って戦う。

※ デッキ構築制度は廃止済み。代わりに毎ターン枠 (operator / number / other) 分のカードが、
それぞれ独立した共通プールから重み付きで抽選される。一度配られたカードは確率が減衰する。
詳細は「カードシステム」参照。

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
│   ├── page.tsx                 # ロビー (名前入力 + ルーム作成/参加)
│   ├── layout.tsx               # ルートレイアウト
│   ├── globals.css              # グローバルスタイル + デザイントークン
│   └── game/[roomId]/           # ゲームルーム画面
├── components/
│   └── game/                    # ゲームUI
│       ├── GameScreen.tsx        # ゲーム全体レイアウト
│       ├── GameField.tsx         # フィールド描画 (弾・プレイヤー・曲線・軌跡・アイテム)
│       ├── BackgroundGrid.tsx    # 背景グリッド (数学座標)
│       ├── ActionPanel.tsx       # アクション選択UI
│       ├── HandDisplay.tsx       # 手札カード表示 (各カードに🗑️ 捨てボタン)
│       ├── NextDrawPreview.tsx   # 次ターンに来る補充カードのプレビュー (両者公開)
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
│       ├── ActionLog.tsx         # アクションログ (手札変動・回復セクション含む)
│       ├── OpponentInfo.tsx      # 相手の公開情報 (手札枚数・次ターン補充プレビュー等)
│       ├── CardOrbOverlay.tsx    # 新規カード玉飛行演出 (プール / アイテム発信)
│       ├── TurnResult.tsx        # ターン結果表示
│       └── GameOver.tsx          # ゲーム終了画面
├── lib/
│   ├── types.ts                 # 共有型定義 + cardKey/handItemLabel ユーティリティ (後述)
│   ├── constants.ts             # ゲームバランス定数・デフォルトプール
│   ├── pool-draw.ts             # 共通プールからの重み付き抽選 (drawForTurn / drawOneFromSlot)
│   ├── calc-engine.ts           # カード計算ロジック (∞ 入力対応、∞÷∞=0)
│   ├── func-engine.ts           # 関数アクション (式の構築・評価・適用)
│   ├── physics.ts               # 弾の移動・反射・衝突判定 (矩形含む)
│   ├── damage.ts                # ダメージ計算・HP管理 (負ダメージ = 回復)
│   ├── prime.ts                 # 素数判定 (素数弾の特殊衝突に使用)
│   ├── items.ts                 # アイテムのスポーン・撃破・接触拾得・効果適用
│   ├── effects.ts               # ビジュアルエフェクト用シングルトンストア (shake/flash 等)
│   ├── config.ts                # game-config.json の読み込み (サーバー専用)
│   ├── curve-collision.ts       # 曲線とプレイヤー/曲線同士の衝突判定
│   ├── coordinates.ts           # 数学座標 ↔ ピクセル座標の変換
│   ├── trajectory.ts            # クライアント側の弾軌跡予測
│   ├── json-codec.ts            # WebSocket境界の Infinity セーフ JSON
│   └── game-logic.ts            # ゲーム状態管理 (executeDraw / resolveActions / applyImmediateMove / applyDiscard)
├── server/
│   └── index.ts                 # WebSocketサーバー (ws) — 接続管理 + ゲーム進行 + HandLog バッファ
├── hooks/
│   └── useGameSocket.ts         # ネイティブWebSocketフック
├── render.yaml                  # Render Blueprint (ws サーバーのデプロイ設定)
├── game-config.json             # サーバー側の動的バランス設定 (任意)
├── DEPLOYMENT.md                # Vercel + Render デプロイ手順
└── CLAUDE.md                    # このファイル
```

---

## ゲーム仕様

### 用語定義

- **数字カード**: 数字のカード全般。手札にあるベース数字 (`NumberCard`) と計算結果として生成される数値トークン (`NumberToken`) の両方を含む。値は整数・負数・小数・±∞ すべて取りうる。
- **演算カード**: `+`, `-`, `×`, `÷` の演算子カード (`OperatorCard`)。
- **移動カード**: `↑`/`↓`/`←`/`→` の方向ごとに分かれたカード (`MoveCard`)。手札から消費して即時に1方向40px動く。
- **素数弾**: **値が10以上の素数**である弾 (例: 11, 13, 17, 19, 23, ...)。整数のみ素数判定対象 (小数・負数・∞ は対象外)。判定は `lib/prime.ts` の `isPrimeBullet()`。
- **無限弾**: 値が ±∞ の弾。射出位置に静止し続け、ヒットすれば即死ダメージ。素数弾とはすり抜け、∞ 同士もすり抜ける。
- **アイテム**: フィールド上にスポーンする獲得可能オブジェクト (`FieldItem`)。種別は `+`/`-`/`×`/`÷`/`pack`/`heal`。
- **スロット (枠)**: 毎ターン補充の単位。`operator` / `number` / `other` の3種類。それぞれ独立した共通プールから抽選される。
- **カードプール**: 各スロット種別ごとに定義された `PoolEntry[]`。`baseWeight` と `decayFactor^drawCount` で実効重みが決まる。

### カードシステム

**カードの種類:**
- **数字カード**: 任意の数値 (整数 / 0 / 負数 / 小数 / ±∞)。プール定義で自由に追加可能。
- **演算カード**: `+`, `-`, `×`, `÷`
- **移動カード**: 上下左右の4方向。1枚ごとに方向が固定。手札タップで即時発動 (その他枠)
- **関数カード**: 手札タップで関数定義モードに入る。`ƒ` 表記。1 枚消費して関数アクションを発動 (その他枠)
- **数値トークン**: 計算アクションで生成される合成済み数値 (手札上に保持。これも数字カード扱い)

**毎ターンの補充ルール (デッキ制度廃止後):**
- 各ターン開始時、**`slots` の枠数に従って、各枠のカードプールから独立に重み付き抽選**する。
- デフォルトの枠数: `operator: 1, number: 2, other: 1` (合計 4 枚 / ターン)。
- 抽選した補充カードは**ターン開始の1つ前のタイミングで事前にロックされ**、`PlayerState.nextDraw` に保存される。
  両プレイヤーの `nextDraw` は **両者公開** で UI 上にプレビュー表示される (`NextDrawPreview` コンポーネント)。
- 手札上限 (`MAX_HAND_SIZE = 16`) を超える分はスキップされる (補充された予定カードのうち、上限超過分は静かに失われる)。

**初期手札 (試合開始時):**
- 試合開始時、**`initialSlots` の枠数に従って各プレイヤーへ初期手札を配る**。
- デフォルト: `operator: 2, number: 3, other: 2` (合計 7 枚)。
- 初期手札も同じ共通プール (`pools`) から重み付き抽選され、`drawCounts` に加算される (= 確率低下が効く)。
- 初期手札を配ったあと、**ターン1の `nextDraw` も別途事前抽選される** (初期手札と毎ターン補充は独立)。
- `initialSlots` を `{ operator: 0, number: 0, other: 0 }` にすると初期手札なしで開始できる。

**確率低下 (永続スタック式):**
- プレイヤーごとに「これまで配られたカードの累積回数」を `drawCounts: Record<CardKey, number>` で保持。
- 各 PoolEntry の実効重み = `baseWeight × decayFactor ^ drawCounts[cardKey]`
- 一度配るたびに `drawCounts[cardKey]` が +1 され、そのカードの確率が `decayFactor` 倍に減衰する。
- `decayFactor = 1.0` で減衰なし、`0.5` で配るたび半減。試合中ずっと持続 (リセットなし)。
- 全エントリの実効重みが 0 まで減衰した場合は `baseWeight` ベースで再抽選するフォールバックがある (`lib/pool-draw.ts`)。

**カードプールの定義 (`game-config.json`):**
```json
{
  "slots":   { "operator": 1, "number": 2, "other": 1 },
  "decayFactor": 0.5,
  "pools": {
    "operator": [
      { "card": { "type": "operator", "operator": "+" }, "baseWeight": 1 },
      { "card": { "type": "operator", "operator": "-" }, "baseWeight": 1 },
      { "card": { "type": "operator", "operator": "×" }, "baseWeight": 1 },
      { "card": { "type": "operator", "operator": "÷" }, "baseWeight": 1 }
    ],
    "number": [
      { "card": { "type": "number", "value": 0 },   "baseWeight": 1 },
      { "card": { "type": "number", "value": 1 },   "baseWeight": 1 },
      { "card": { "type": "number", "value": -1 },  "baseWeight": 0.5 },
      { "card": { "type": "number", "value": 0.5 }, "baseWeight": 0.3 },
      { "card": { "type": "number", "value": "Infinity" }, "baseWeight": 0.05 }
    ],
    "other": [
      { "card": { "type": "move", "direction": "up" },    "baseWeight": 1 },
      { "card": { "type": "move", "direction": "down" },  "baseWeight": 1 },
      { "card": { "type": "move", "direction": "left" },  "baseWeight": 1 },
      { "card": { "type": "move", "direction": "right" }, "baseWeight": 1 },
      { "card": { "type": "function" },                   "baseWeight": 0.3 }
    ]
  }
}
```
- `slots[kind]` は 0 以上の整数。`0` を指定するとその枠は補充されない。
- `value` には数値リテラルのほか `"Infinity"` / `"-Infinity"` 文字列が使える (`lib/json-codec.ts` のセンチネルと同じ流儀)。
- `baseWeight` は正の数 (省略時 / 不正値は `1.0` にフォールバック)。
- `other` 枠は移動カード・関数カードを供給する用途 (今後の新カード追加先)。`{ "type": "function" }` で関数カードを定義。

**手札の制限:**
- 手札上限: **16枚** (`MAX_HAND_SIZE`、`game-config.json` で上書き可)
- 計算で使えるカード枚数の上限: **5枚** (`MAX_CALC_CARDS`)

**手札ログ (自分分のみ):**
- カードの追加 (補充 / 計算結果 / アイテム獲得) と削除 (攻撃 / 計算消費 / 関数消費 / 移動使用 / 捨て) は
  `TurnResult.handLog: HandLogEntry[]` に記録され、ActionLog の「手札の変動」セクションに表示される。
- サーバーは viewer ごとに事前バッファ (`pendingHandEvents`) で蓄積し、ターン結果送信時に
  そのプレイヤー自身のエントリだけを TurnResult に乗せる (他プレイヤーには見えない)。

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

1. **ドローフェーズ** — サーバーで各プレイヤーの **nextDraw (ロック済み補充)** を手札に追加 → 次ターン用の新しい nextDraw を抽選 → アイテムスポーン
2. **アクション選択フェーズ** — 両者が同時に「メインアクション」を1つ選ぶ (タイムアウト45秒、`game-config.json` で変更可)
   - 移動カード使用・計算・**捨て (discard)** は **このフェーズ中に何度でも即時実行可能** (メインアクションを消費しない)
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
- **∞ も計算に使える** (旧仕様では禁止だったが解放)。特殊ケース:
  - `∞ ÷ ∞ = 0` (ユーザー仕様で明示)
  - `1 ÷ 0 = ∞`, `-1 ÷ 0 = -∞` (発散)
  - `0 ÷ 0`, `∞ - ∞`, `∞ × 0` 等の NaN → 計算失敗 (消費なし)
- 計算失敗 (0除算/NaN・パターン違反) の場合は手札消費なし
- **素数合成演出**: 計算結果が **10以上の素数** の場合、画面中央に「PRIME!」テキストと値がフェードイン→フェードアウトで表示される。生成された数値トークンには手札上で持続的な紫〜青の素数オーラが表示される (`HandDisplay` / `PrimeAura`)

**捨て (`discard`):**
- 手札のカード1枚を即時に捨てる。回数無制限。
- アクション選択フェーズ中のみ実行可能。
- 確率低下カウント (`drawCounts`) には影響しない (= 一度配られた事実は残る)。
- 数値トークン・移動カードも対象。「🗑️ 捨てる」モードに入って手札タップで実行。

**関数 (`function`):**
- **関数カード 1 枚 を消費して即時に関数式を定義する** (回数制限なし、関数カードがある限り)。
- 手札の関数カード `ƒ` をタップ → 関数定義モード → 手札の数値・演算子・x を交互に並べる → 「定義」で確定。
- フィールド上に曲線が恒久的に描かれ、毎ターン判定される。
- **アクションフェーズ中は相手から秘匿される**: 定義した曲線はそのターンの解決フェーズ (TurnResult 表示時) に初めて相手に公開される。サーバーはターン開始時の曲線 ID をスナップショット (`turnStartCurveIds`) し、`sanitizeStateForPlayer` で相手視点から新規曲線を除外する。打ち消し演出 (`curveEvents`) も発動者にだけ即時表示し、相手には配信しない。
- 曲線上に敵プレイヤーがいると **10ダメージ**/ターン (`FUNCTION_DAMAGE`)。自分の曲線は自分にダメージを与えない。
- 式の構成: 数値/x と演算子を **交互** に並べる (最小3要素、上限なし)。
  - 式の評価範囲: x ∈ [-10, 10]、y が [-5, 5] を超える区間は描画・判定なし
  - 評価順序は計算アクションと同じ通常の優先順位 (× ÷ が + - より先)
- 同じ式の曲線を相手が先に持っている場合、発動時に **両者を打ち消し合う** (`TurnResult.curveEvents` に記録)。
- 旧仕様の `MAX_FUNCTION_USES` (10回上限) は **廃止**。関数カードを引かない限り使えない。
- 関数カード自身は ∞ や移動カードと同様、計算アクション・攻撃には使えない。

#### メインアクション (1ターンに1つ・送信でターン解決へ)

**攻撃 (`attack`):**
- 手札の数字/トークンを1つ選んで、正面方向に弾として発射する
- 弾は手札から消費される

**スキップ (`skip`):**
- メインアクションを行わない
- アクションタイムアウト時は自動的にこれが入る

### 弾の挙動

**速度:**
- `speed = 80 / (1 + |value| × 0.15)`
- 小さい絶対値ほど速く、大きい絶対値ほど遅い
- **∞ 弾は速度 0** (createBullet で射出位置の目の前に静止配置) → 動かない代わりに通り過ぎる敵を即死させる

**衝突 (弾 vs 弾):**
- 味方弾同士は衝突しない (すり抜ける)
- **素数弾 (値が10以上の素数) は特殊扱い**:
  - 素数弾 vs 通常弾: 通常弾は素数弾の値だけ削られる (≤0なら消滅)。素数弾は値も方向も変わらず**そのまま貫通**する
  - 素数弾 vs 素数弾: **通常弾同士と同じ大小相殺** (大きい方が小さい方の値だけ削られて残る。同値なら両方消滅)
- **∞ 弾**:
  - ∞ vs ∞: 両者すり抜け
  - ∞ vs 素数弾: すり抜け
  - ∞ vs 通常弾: 通常弾は消滅、∞ はそのまま残る (静止し続ける)
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
- **負の値の弾は回復として扱う**: 値が負なら、ヒットした相手の HP が `|value|` だけ回復する (初期HPでクランプ)。`TurnResult.heals` に集計される
- **∞ 弾は即死ダメージ** (`applyDamage` で HP = 0)
- **0 ダメージ弾**: 当たっても HP 変化なし。衝突演算には参加する

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

---

## 主要な型定義 (lib/types.ts)

```ts
// --- カード ---
type Direction = 'up' | 'down' | 'left' | 'right'
type NumberCard   = { type: 'number';   value: number }          // value は ±∞・負・小数 OK
type OperatorCard = { type: 'operator'; operator: '+' | '-' | '×' | '÷' }
type MoveCard     = { type: 'move';     direction: Direction }
type FunctionCard = { type: 'function' }                          // 関数アクション発動用 (1枚消費)
type Card = NumberCard | OperatorCard | MoveCard | FunctionCard
type NumberToken  = { type: 'token'; value: number }
type HandItem     = Card | NumberToken

// --- スロット & プール ---
type SlotKind = 'operator' | 'number' | 'other'
interface PoolEntry {
  card: Card
  baseWeight: number      // 実効重み = baseWeight × decayFactor^drawCounts[cardKey(card)]
}
type CardKey = string     // cardKey(card) で正規化 (例: "n:5" / "n:Inf" / "o:+" / "m:up")

// --- 手札ログ (自分分のみ) ---
type HandLogReason =
  | 'draw_op' | 'draw_num' | 'draw_other'      // 補充 (枠ごと)
  | 'attack' | 'calc'                          // メイン or 即時アクションでの消費
  | 'function'                                 // 関数カード/式構成カードの消費 (即時)
  | 'calc_result'                              // 計算結果として追加
  | 'use_move' | 'discard'                     // 即時アクションでの消費
  | 'item_kill' | 'item_pickup'                // アイテムからの追加
interface HandLogEntry {
  kind: 'add' | 'remove'
  cardLabel: string       // '7' '∞' '+' '↑' など
  reason: HandLogReason
}

// --- アクション ---
// use_move_card / calculate / discard / function は即時適用 (回数制限なし)
// attack / skip は「メインアクション」で、両プレイヤーが submit するとターンが解決される
type Action =
  | { type: 'use_move_card'; handIndex: number }
  | { type: 'calculate';     cardIndices: number[] }
  | { type: 'attack';        handIndex: number }
  | { type: 'function';      functionCardIndex: number; cardIndices: number[]; xPositions: number[] }
  | { type: 'discard';       handIndex: number }
  | { type: 'skip' }

// --- プレイヤー ---
interface PlayerState {
  id: string
  name: string
  hp: number
  position: Position
  facing: 'left' | 'right'
  hand: HandItem[]
  drawCounts: Record<CardKey, number>   // 抽選確率低下の累積カウント
  nextDraw: HandItem[]                  // 次ターンに来る予定 (ロック済み・両者公開)
}

// 相手側に公開する情報。手札の中身は非公開だが nextDraw は公開する。
interface SanitizedPlayerState {
  id: string
  name: string
  hp: number
  position: Position
  facing: 'left' | 'right'
  handCount: number
  nextDraw: HandItem[]
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
  maxHandSize: number
  animationDurationMs: number
  slots: Record<SlotKind, number>           // 枠数 (0以上の整数)
  pools: Record<SlotKind, PoolEntry[]>      // 各枠のカードプール
  decayFactor: number                       // (0, 1] の確率低下係数
}

// --- ターン結果 ---
interface TurnResult {
  actions: Record<string, { type: string; description: string }>
  damages: Record<string, number>           // 純ダメージ合計 (回復は含まない)
  curveDamages: Record<string, number>      // 曲線ダメージ
  heals?: Record<string, number>            // 負ダメージ弾・heal アイテム由来の回復
  bulletEvents: string[]
  bulletSnapshots: BulletSnapshot[]         // 物理シミュレーションの各tick状態
  playerPositions: Record<string, Position>
  curveEvents?: string[]
  primeSynthesis?: Record<string, number>
  itemKills?: Array<{ itemId; kind; killerId; awardedCount }>
  itemPickups?: Array<{ itemId; kind; pickerId; awardedCount }>
  handLog?: HandLogEntry[]                  // 自分分のみ (viewer ごとにフィルタ後)
}

// --- 共通ユーティリティ ---
function cardKey(c: Card): CardKey            // "n:5" / "n:Inf" / "o:+" / "m:up"
function handItemLabel(item: HandItem): string // '7' '∞' '+' '↑' などの表示用
```

---

## WebSocketサーバー (server/index.ts) の責務

サーバーが権威を持つ設計 (Server Authoritative)。

1. **接続処理**: プレイヤーのルーム参加 (最大2人)。`join` メッセージは `name` のみ (デッキ送信は廃止)
2. **ハートビート**: 30秒ごとに ping → pong が返らない接続は terminate (ホスティング側 LB のアイドル切断対策)
3. **ゲーム開始** (`startGame`): 各プレイヤーの「ターン1で配られるカード」を **事前抽選** して `PlayerState.nextDraw` にロック。`drawCounts` も同時に加算
4. **ドロー処理** (`executeDraw`): ターン開始時に **既にロック済みの nextDraw を手札に追加** → 次ターン用の新しい nextDraw を `drawForTurn` で抽選 → アイテムスポーン + 接触拾得を解決。**数字補充・移動自動補充ロジックは廃止**
5. **即時アクション処理** (アクション選択フェーズ中、何度でも):
   - **移動カード使用 (`use_move_card`)**: 手札から該当カードを消費して即時移動。本人にだけ新しい状態を返す (相手には移動を秘匿、`turnStartPositions` で位置を上書き)
   - **計算 (`calculate`)**: 手札を更新して即時送信。素数合成検出時は `primeSynthesis` イベントを TurnResult として送る
   - **捨て (`discard`)**: 該当カードを即時に手札から除去
   - **関数 (`function`)**: 関数カード 1 枚 + 式構成カードを消費して `FunctionCurve` をフィールドに追加 (`applyFunctionImmediate`)。同式の相手曲線と即時に打ち消し合う場合は `curveEvents` を両者に配信
6. **HandLog バッファ** (`pendingHandEvents`): すべての手札変化 (補充 / 即時アクション / メインアクション解決時の消費 / アイテム獲得) を **viewer ごと** にバッファし、次のターン結果送信時に `TurnResult.handLog` として「自分分のみ」配信
7. **メインアクション受信**: `attack` / `skip` を待つ (タイムアウト時は `skip` 自動投入)
8. **解決処理** (`lib/game-logic.ts` の `resolveActions`):
   - 攻撃: 弾を生成、手札から消費 (HandLog: remove × 1)
9. **弾の物理シミュレーション** (毎ターン10tick = `PHYSICS_TICKS_PER_TURN`):
   - 全弾を速度に応じて移動 (`lib/physics.ts`)
   - 壁反射の判定 (数値 +3 · 反射回数インクリメント)
   - 弾同士の衝突判定 (素数弾 / ∞ 弾は特殊)
   - プレイヤー / アイテム矩形へのヒット判定 → ダメージ適用 (負ダメージは回復に振り分け)・アイテム撃破処理
10. **曲線ダメージ判定**: 全カーブをサンプリングし、敵プレイヤーが曲線上にいれば10ダメージ (`lib/curve-collision.ts`)
11. **アイテム接触拾得**: 移動で踏んだ瞬間に拾得し、TurnResult までバッファ (`pendingItemPickups`)
12. **勝敗判定**: HP <= 0 を検出 → gameover をブロードキャスト
13. **情報の非対称性**: 相手の手札の中身・移動カードによる即時移動・**アクションフェーズ中に定義された新規関数曲線** は秘匿。見せるのは枚数・**次ターン補充プレビュー (nextDraw)**・ターン開始位置・公開済みのフィールド要素 (= ターン開始時点で存在した曲線とそれ以降の物理オブジェクト)

**JSON境界:** WebSocket メッセージは `lib/json-codec.ts` の `encodeMessage`/`decodeMessage` 経由で送受信する。`Infinity`/`-Infinity` をセンチネル文字列で保持する目的 (∞ カード値・発散計算結果などを保持するため)。

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

## Git 運用ルール (こまめにプッシュする)

**原則:** 「ある程度の変更」が区切りに達したら、その都度コミット & `git push origin main` まで行うこと。ローカルに変更を溜め込まない。

### プッシュする区切りの目安 (いずれかを満たしたら push する)

- **機能単位:** 1つの機能・バグ修正・リファクタが動く状態になった (例: 新カード追加、ダメージ計算修正、UI 1コンポーネントの追加)
- **ファイル規模:** 変更行数が **およそ 200 行** を超えた、または 5 ファイル以上を触った
- **時間単位:** 連続して作業しているとき、**30〜60分** ごとに区切りを作る
- **タスク終了時:** ユーザーへの返答 (「完了しました」等) を返す直前は必ず確認する
- **ビルドが通る状態:** `npm run build` が成功するタイミング。失敗するコードは push しない (WIP コミットを残したい場合は別ブランチで)

### 手順 (毎回これを踏む)

1. `git status` / `git diff` で変更内容を確認する
2. 機密ファイル (`.env`, 認証情報) が含まれていないか確認する
3. ファイル単位で `git add <path>` する。**`git add -A` / `git add .` は使わない** (意図しないファイル混入を避けるため)
4. コミットメッセージは Conventional Commits 風に短く書く:
   - `feat(items): <要約>` / `fix(curves): <要約>` / `refactor(server): <要約>` / `docs: <要約>` / `chore: <要約>`
   - 本文に Co-Authored-By 行を必ず付ける (リポジトリ既存コミットに準拠)
5. `git push origin main` でリモートに反映する
6. push 失敗時 (リモートが進んでいる等) は `git pull --rebase origin main` で取り込み、衝突を解消してから再 push

### やってはいけないこと

- **`--no-verify` / `--no-gpg-sign`** などフック・署名のスキップ (ユーザーが明示的に指示したときのみ)
- **`git push --force` / `--force-with-lease`** を `main` に対して使用すること
- **`git commit --amend`** で既に push 済みのコミットを書き換えること
- **ユーザーが明示的にコミットを指示していないのに勝手にコミットすること** (Git 安全プロトコル準拠)
  - ※ ただしユーザーから「こまめに push して」と継続指示が出ている場合 (本ドキュメント運用時) はその指示を許可と見なす
- ビルドエラー・型エラーを残したまま push すること

### コミットメッセージ例

```
feat(calc): add prime synthesis particle effect

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

```
fix(physics): correct prime bullet pass-through on equal values

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

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
  "actionTimeoutSec": 45,
  "slots":        { "operator": 1, "number": 2, "other": 1 },
  "initialSlots": { "operator": 2, "number": 3, "other": 2 },
  "decayFactor": 0.5,
  "pools": {
    "operator": [
      { "card": { "type": "operator", "operator": "+" }, "baseWeight": 1 }
    ],
    "number": [
      { "card": { "type": "number", "value": 0 }, "baseWeight": 1 },
      { "card": { "type": "number", "value": "Infinity" }, "baseWeight": 0.05 }
    ],
    "other": [
      { "card": { "type": "move", "direction": "up" }, "baseWeight": 1 }
    ]
  }
}
```

### キー一覧

| キー | デフォルト | 説明 |
|------|-----------|------|
| `actionTimeoutSec` | `45` | アクション選択フェーズのタイムアウト (秒)。**`0` 以下を指定すると時間制限なし** |
| `bulletDiameter` | `20` | 弾の当たり判定の直径 (px) |
| `playerDiameter` | `48` | プレイヤーの当たり判定の直径 (px) |
| `moveDistance` | `40` | 1ターンあたりの移動距離 (px) |
| `wallReflectionBonus` | `3` | 壁反射時に弾の数値に加算される量 (整数) |
| `mathXMax` | `10` | 数学座標の x 軸の右端 (左端は -mathXMax、対称) |
| `itemSize` | `40` | アイテムの当たり判定の直径 (px) |
| `itemSpawnRates` | 既定値 | アイテム種別ごとの絶対出現確率 (各 0..1 でクランプ) |
| `maxItems` | `5` | フィールド上の同時存在アイテム数 |
| `healAmountMin/Max` | `5 / 20` | heal アイテム取得時の回復量レンジ |
| `maxHandSize` | `16` | 手札の上限枚数 |
| `animationDurationMs` | `3000` | ターン解決アニメーションの総再生時間 (ms、最低 200) |
| `slots` | `{ operator: 1, number: 2, other: 1 }` | 各枠の毎ターン補充枚数 (0 以上の整数) |
| `initialSlots` | `{ operator: 2, number: 3, other: 2 }` | 試合開始時の初期手札の枠数 (0 以上の整数) |
| `pools[kind]` | デフォルトプール (1〜9 / +-×÷ / ↑↓←→) | 各枠のカードプール。`PoolEntry[]` |
| `decayFactor` | `0.5` | 永続スタック式の確率低下係数。`(0, 1]` の範囲。`1.0` で減衰なし |

### `pools[kind]` の形式

各要素は `{ card: Card, baseWeight: number }` の形:
- `card.type === 'number'` の場合: `value` に数値リテラル または `"Infinity"` / `"-Infinity"` 文字列
- `card.type === 'operator'` の場合: `operator` は `+`/`-`/`×`/`÷` のいずれか
- `card.type === 'move'` の場合: `direction` は `up`/`down`/`left`/`right` のいずれか
- `baseWeight` は正の数 (省略/不正値は `1.0` にフォールバック)

実装は `lib/config.ts` + `lib/pool-draw.ts`。サーバー (`server/index.ts`) が `loadConfig()` を起動時に1回呼び、同時に `toGameSettings()` で `GameSettings` を構築する。

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
| デフォルト枠数 | operator:1 / number:2 / other:1 (= 計4枚/ターン) | `DEFAULT_SLOTS` |
| デフォルト初期手札 | operator:2 / number:3 / other:2 (= 計7枚) | `DEFAULT_INITIAL_SLOTS` |
| デフォルト確率低下係数 | 0.5 (永続スタック) | `DEFAULT_DECAY_FACTOR` |
| デフォルトプール | 数字 1〜9 / 演算子 +-×÷ / 移動 ↑↓←→ | `DEFAULT_POOLS` |
| 手札上限 | 16枚 | `MAX_HAND_SIZE` |
| 計算使用カード上限 | 5枚 | `MAX_CALC_CARDS` |
| 弾の基準速度 | 80 px/tick | `BASE_BULLET_SPEED` |
| 弾の減速係数 | 0.15 | `SPEED_DECAY_FACTOR` |
| 壁反射の数値増加 | +3 | `WALL_REFLECTION_BONUS` |
| 反射回数上限 | 3回 | `MAX_REFLECTIONS` |
| 物理 tick / ターン | 10 | `PHYSICS_TICKS_PER_TURN` |
| 関数使用回数上限 | 廃止 (関数カードのプール出現率で制御) | — |
| 関数カードのデフォルト重み | 0.3 (= 移動カードの 1/3) | `DEFAULT_POOLS.other` 内 |
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
- 確率低下係数 (`decayFactor`) のデフォルト値・特殊カード (∞/負/小数) のプール推奨値
- 各枠数のデフォルト (現状 1/2/1 = 4枚/ターン)
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
