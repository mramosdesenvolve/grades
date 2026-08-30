/** Formata 8 como "8" e 7.5 como "7,5" (aceita negativos). */
export function fmtHours(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  return sign + (Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ','))
}
