import type { PlayerState } from './types'
import { INITIAL_HP } from './constants'

// 通常の正のダメージを適用する (負値は呼び出し側で回復処理に振り分け済みの想定)。
// HP は 0 未満にならない。
export const applyDamage = (
  player: PlayerState,
  amount: number
): PlayerState => {
  // 負ダメージ (= 回復) もここで safe に処理: HP を INITIAL_HP 上限でクランプ
  if (amount < 0) {
    return {
      ...player,
      hp: Math.min(INITIAL_HP, player.hp + -amount),
    }
  }
  // ∞ ダメージは即死扱い
  if (!Number.isFinite(amount)) {
    return { ...player, hp: 0 }
  }
  return {
    ...player,
    hp: Math.max(0, player.hp - amount),
  }
}

export const checkGameOver = (
  players: Record<string, PlayerState>
): { gameOver: boolean; winnerId: string | null } => {
  const entries = Object.entries(players)
  const dead = entries.filter(([, p]) => p.hp <= 0)

  if (dead.length === 0) return { gameOver: false, winnerId: null }

  if (dead.length >= 2) return { gameOver: true, winnerId: null } // 引き分け

  // 1人だけ死亡 → もう1人が勝者
  const winnerId = entries.find(([, p]) => p.hp > 0)?.[0] ?? null
  return { gameOver: true, winnerId }
}
