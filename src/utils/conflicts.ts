import { TIME_SLOTS } from '../data/seed'
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

const MAX_DAILY_ENTRIES = 8

/**
 * Regra do sindicato: nenhum professor pode ter mais de 8 tempos (regência
 * ou planejamento, somados) no mesmo dia. Semana A e Semana B são contadas
 * separadamente, já que não acontecem na mesma semana real; "Ambas" entra
 * na contagem das duas.
 */
export function findDailyOverloadEntries(schedule: ScheduleEntry[]): Set<string> {
  const overloaded = new Set<string>()
  const byTeacherDay = new Map<string, ScheduleEntry[]>()
  for (const e of schedule) {
    const key = `${e.teacherId}::${e.day}`
    const list = byTeacherDay.get(key)
    if (list) list.push(e)
    else byTeacherDay.set(key, [e])
  }
  for (const entries of byTeacherDay.values()) {
    for (const week of ['A', 'B'] as const) {
      const dayEntries = entries.filter((e) => e.week === week || e.week === 'AMBAS')
      if (dayEntries.length > MAX_DAILY_ENTRIES) {
        for (const e of dayEntries) overloaded.add(e.id)
      }
    }
  }
  return overloaded
}

const LAST_MORNING_SLOT = 'm6'
const FIRST_AFTERNOON_SLOT = 'v1'

/**
 * Regra do sindicato: o professor precisa ter um horário de almoço — não
 * pode estar ocupado simultaneamente no último tempo da manhã (m6) e no
 * primeiro da tarde (v1) no mesmo dia/semana real.
 */
export function findLunchBreakViolations(schedule: ScheduleEntry[]): Set<string> {
  const violations = new Set<string>()
  const byTeacherDay = new Map<string, ScheduleEntry[]>()
  for (const e of schedule) {
    if (e.timeSlotId !== LAST_MORNING_SLOT && e.timeSlotId !== FIRST_AFTERNOON_SLOT) continue
    const key = `${e.teacherId}::${e.day}`
    const list = byTeacherDay.get(key)
    if (list) list.push(e)
    else byTeacherDay.set(key, [e])
  }
  for (const entries of byTeacherDay.values()) {
    const morning = entries.filter((e) => e.timeSlotId === LAST_MORNING_SLOT)
    const afternoon = entries.filter((e) => e.timeSlotId === FIRST_AFTERNOON_SLOT)
    for (const a of morning) {
      for (const b of afternoon) {
        if (weeksOverlap(a.week, b.week)) {
          violations.add(a.id)
          violations.add(b.id)
        }
      }
    }
  }
  return violations
}

/**
 * Chave usada em findGapSlots: identifica um horário (turno) vago
 * específico de um professor. Usada para marcar CÉLULAS VAZIAS (não há
 * ScheduleEntry para um horário vago), então não dá pra usar um id de
 * entrada como nas outras checagens.
 */
export function gapSlotKey(teacherId: string, day: string, timeSlotId: string, week: 'A' | 'B'): string {
  return `${teacherId}::${day}::${timeSlotId}::${week}`
}

/**
 * Regra do sindicato: a partir do momento em que o professor começa a
 * trabalhar num turno (primeiro tempo ocupado, seja regência, planejamento
 * ou orientação), ele não pode ter horário vago até o último tempo ocupado
 * daquele turno. O intervalo de almoço (entre o turno da manhã e da tarde)
 * não conta como "vago" aqui — isso já é tratado por findLunchBreakViolations.
 */
export function findGapSlots(schedule: ScheduleEntry[]): Set<string> {
  const gaps = new Set<string>()
  const byTeacherDay = new Map<string, ScheduleEntry[]>()
  for (const e of schedule) {
    const key = `${e.teacherId}::${e.day}`
    const list = byTeacherDay.get(key)
    if (list) list.push(e)
    else byTeacherDay.set(key, [e])
  }
  const shifts = ['Matutino', 'Vespertino'] as const

  for (const [key, entries] of byTeacherDay.entries()) {
    const [teacherId, day] = key.split('::')
    for (const week of ['A', 'B'] as const) {
      const weekEntries = entries.filter((e) => e.week === week || e.week === 'AMBAS')
      for (const shift of shifts) {
        const shiftSlots = TIME_SLOTS.filter((s) => s.shift === shift)
        const occupiedOrders = new Set(
          shiftSlots
            .filter((s) => weekEntries.some((e) => e.timeSlotId === s.id))
            .map((s) => s.order),
        )
        if (occupiedOrders.size === 0) continue
        const min = Math.min(...occupiedOrders)
        const max = Math.max(...occupiedOrders)
        for (const slot of shiftSlots) {
          if (slot.order > min && slot.order < max && !occupiedOrders.has(slot.order)) {
            gaps.add(gapSlotKey(teacherId, day, slot.id, week))
          }
        }
      }
    }
  }
  return gaps
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
