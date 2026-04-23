import type { PlayerState } from './types'

export const applyDamage = (
  player: PlayerState,
  amount: number
): PlayerState => {
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
