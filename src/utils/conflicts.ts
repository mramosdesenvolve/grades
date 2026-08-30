import type { ScheduleEntry, WeekType } from '../types'

/** Duas semanas "colidem" se forem iguais ou se uma delas for AMBAS. */
function weeksOverlap(a: WeekType, b: WeekType): boolean {
  if (a === b) return true
  return a === 'AMBAS' || b === 'AMBAS'
}

/**
 * Retorna o conjunto de ids de ScheduleEntry que estão em conflito: mesmo
 * professor ocupado em dois compromissos (aula em outra turma, ou
 * planejamento) no mesmo dia/horário, com semanas sobrepostas.
 */
export function findTeacherConflicts(schedule: ScheduleEntry[]): Set<string> {
  const conflicts = new Set<string>()

  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      const a = schedule[i]
      const b = schedule[j]
      if (a.teacherId !== b.teacherId) continue
      if (a.day !== b.day) continue
      if (a.timeSlotId !== b.timeSlotId) continue
      if (!weeksOverlap(a.week, b.week)) continue
      conflicts.add(a.id)
      conflicts.add(b.id)
    }
  }

  return conflicts
}

export function isSlotConflicted(
  entry: Pick<ScheduleEntry, 'id'>,
  conflicts: Set<string>,
): boolean {
  return conflicts.has(entry.id)
}

/**
 * Peso semanal médio de uma entrada da grade. Um tempo que só ocorre na
 * Semana A (ou só na B) se repete a cada 15 dias, então na média representa
 * meia aula por semana. Um tempo "Ambas" ocorre toda semana e vale 1.
 */
export function entryWeight(entry: Pick<ScheduleEntry, 'week'>): number {
  return entry.week === 'AMBAS' ? 1 : 0.5
}

function sumWeights(entries: ScheduleEntry[]): number {
  return entries.reduce((sum, e) => sum + entryWeight(e), 0)
}

/** Carga horária média semanal alocada de um componente dentro de uma turma. */
export function allocatedHours(
  schedule: ScheduleEntry[],
  classId: string,
  componentId: string,
): number {
  return sumWeights(
    schedule.filter(
      (e) => e.type === 'aula' && e.classId === classId && e.componentId === componentId,
    ),
  )
}

/** Carga de planejamento média semanal alocada de um componente, somando todos os professores. */
export function allocatedPlanningHours(schedule: ScheduleEntry[], componentId: string): number {
  return sumWeights(schedule.filter((e) => e.type === 'planejamento' && e.componentId === componentId))
}
