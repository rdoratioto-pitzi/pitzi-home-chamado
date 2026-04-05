export type HealthStatus = 'on_track' | 'at_risk' | 'off_track'

export const QUARTER_RANGES: Record<string, { start: Date; end: Date }> = {
  '2025-Q1': { start: new Date('2025-01-01'), end: new Date('2025-03-31') },
  '2025-Q2': { start: new Date('2025-04-01'), end: new Date('2025-06-30') },
  '2025-Q3': { start: new Date('2025-07-01'), end: new Date('2025-09-30') },
  '2025-Q4': { start: new Date('2025-10-01'), end: new Date('2025-12-31') },
  '2026-Q1': { start: new Date('2026-01-01'), end: new Date('2026-03-31') },
  '2026-Q2': { start: new Date('2026-04-01'), end: new Date('2026-06-30') },
  '2026-Q3': { start: new Date('2026-07-01'), end: new Date('2026-09-30') },
  '2026-Q4': { start: new Date('2026-10-01'), end: new Date('2026-12-31') },
}

/**
 * Calcula saúde automática de um KR com base no progresso relativo ao tempo
 * decorrido no ciclo.
 *
 * Ciclo não iniciado  → on_track
 * Ciclo encerrado     → on_track ≥70%, at_risk ≥40%, off_track <40%
 * Ciclo em andamento  → compara progresso com % do tempo decorrido:
 *   ≥ 90% do tempo    → on_track
 *   ≥ 60% do tempo    → at_risk
 *   <  60% do tempo   → off_track
 */
export function calculateHealthStatus(
  progressPercent: number,
  cycle: string,
): HealthStatus {
  const range = QUARTER_RANGES[cycle]
  if (!range) return 'on_track'

  const now = new Date()
  if (now < range.start) return 'on_track'

  if (now > range.end) {
    if (progressPercent >= 70) return 'on_track'
    if (progressPercent >= 40) return 'at_risk'
    return 'off_track'
  }

  const total = range.end.getTime() - range.start.getTime()
  const elapsed = now.getTime() - range.start.getTime()
  const timeElapsed = Math.min((elapsed / total) * 100, 100)

  if (progressPercent >= timeElapsed * 0.9) return 'on_track'
  if (progressPercent >= timeElapsed * 0.6) return 'at_risk'
  return 'off_track'
}

/**
 * Saúde do Objetivo = pior saúde entre os KRs filhos.
 * off_track > at_risk > on_track. Sem KRs → on_track.
 */
export function calculateObjectiveHealth(
  krStatuses: HealthStatus[],
): HealthStatus {
  if (krStatuses.length === 0) return 'on_track'
  if (krStatuses.includes('off_track')) return 'off_track'
  if (krStatuses.includes('at_risk')) return 'at_risk'
  return 'on_track'
}
