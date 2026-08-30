import type { ScheduleEntry, Teacher } from '../types'
import { entryWeight } from './conflicts'

export interface TeacherChargeReport {
  regencia: number
  planejamento: number
  demanda2027: number
  saldo: number
  planejamentoLabel: string
}

function sumWeights(entries: ScheduleEntry[]): number {
  return entries.reduce((sum, e) => sum + entryWeight(e), 0)
}

/**
 * Calcula a carga de um professor para a nova grade (2027) e compara com o
 * que já está contratado (2026). Um tempo que só ocorre na Semana A (ou só
 * na B) se repete a cada 15 dias e conta como 0,5 aula/semana em média; um
 * tempo "Ambas" conta como 1.
 *
 * Professor Orientador: acumula regência de 1-2 turmas (FTP + Projeto de Ano
 * Letivo) e o restante até `orientadorTargetHours` é planejamento/orientação
 * administrativa — não precisa estar concretamente alocado na grade.
 */
export function teacherChargeReport(t: Teacher, schedule: ScheduleEntry[]): TeacherChargeReport {
  const regencia = sumWeights(schedule.filter((e) => e.teacherId === t.id && e.type === 'aula'))

  if (t.isOrientador) {
    // horas de planejamento/orientação já lançadas concretamente na grade
    const concreteOther = sumWeights(
      schedule.filter(
        (e) => e.teacherId === t.id && (e.type === 'planejamento' || e.type === 'orientacao'),
      ),
    )
    // o restante até o total-alvo é carga administrativa presumida (não
    // precisa estar detalhada na grade célula a célula)
    const adminGap = Math.max(0, t.orientadorTargetHours - regencia - concreteOther)
    const planejamento = concreteOther + adminGap
    const demanda2027 = Math.max(regencia + concreteOther, t.orientadorTargetHours)
    return {
      regencia,
      planejamento,
      demanda2027,
      saldo: demanda2027 - t.contractedHours2026,
      planejamentoLabel: 'Planejamento e Orientação',
    }
  }

  const planejamento = sumWeights(
    schedule.filter((e) => e.teacherId === t.id && e.type === 'planejamento'),
  )
  const demanda2027 = regencia + planejamento
  return {
    regencia,
    planejamento,
    demanda2027,
    saldo: demanda2027 - t.contractedHours2026,
    planejamentoLabel: 'Planejamento',
  }
}
