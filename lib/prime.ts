// 素数判定ユーティリティ
// 「素数弾」= 値が10以上の素数である弾。
// 整数でない値 (計算で生まれた小数) は素数とは見なさない。

export const isPrime = (n: number): boolean => {
  if (!Number.isInteger(n)) return false
  if (n < 2) return false
  if (n === 2) return true
  if (n % 2 === 0) return false
  const limit = Math.floor(Math.sqrt(n))
  for (let i = 3; i <= limit; i += 2) {
    if (n % i === 0) return false
  }
  return true
}

// 素数弾の閾値: 10以上の素数のみが「素数弾」扱い
export const PRIME_BULLET_MIN = 10

export const isPrimeBullet = (value: number): boolean =>
  value >= PRIME_BULLET_MIN && isPrime(value)
