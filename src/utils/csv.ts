import { TIME_SLOTS } from '../data/seed'
import { WEEKDAYS } from '../types'
import type { ClassGroup, CurricularComponent, ScheduleEntry, Teacher, WeekType } from '../types'

type CsvMode = 'class' | 'teacher' | 'planning'

function cellLabel(
  entries: ScheduleEntry[],
  components: CurricularComponent[],
  teachers: Teacher[],
  classes: ClassGroup[],
  mode: CsvMode,
) {
  return entries
    .map((e) => {
      if (mode === 'planning' && e.type === 'orientacao') {
        return 'Orientação'
      }
      const comp = components.find((c) => c.id === e.componentId)?.name ?? '?'
      if (mode === 'class') {
        const teacher = teachers.find((t) => t.id === e.teacherId)?.name ?? '?'
        return `${comp} (${teacher})`
      }
      if (mode === 'planning') {
        return `${comp} (Planejamento)`
      }
      const klass = classes.find((c) => c.id === e.classId)?.name ?? '?'
      return `${comp} (${klass})`
    })
    .join(' / ')
}

export function exportScheduleCsv(params: {
  schedule: ScheduleEntry[]
  components: CurricularComponent[]
  teachers: Teacher[]
  classes: ClassGroup[]
  week: WeekType
  mode: CsvMode
  entityId: string
  entityName: string
}) {
  const { schedule, components, teachers, classes, week, mode, entityId, entityName } = params

  const filtered = schedule.filter((e) => {
    const matchesEntity = mode === 'class' ? e.classId === entityId : e.teacherId === entityId
    const matchesType =
      mode === 'planning' ? e.type === 'planejamento' || e.type === 'orientacao' : e.type === 'aula'
    const matchesWeek = week === 'AMBAS' ? true : e.week === week || e.week === 'AMBAS'
    return matchesEntity && matchesType && matchesWeek
  })

  const rows: string[][] = []
  rows.push(['Horário', ...WEEKDAYS])

  for (const slot of TIME_SLOTS) {
    const row = [`${slot.label} (${slot.shift})`]
    for (const day of WEEKDAYS) {
      const entries = filtered.filter((e) => e.timeSlotId === slot.id && e.day === day)
      row.push(cellLabel(entries, components, teachers, classes, mode))
    }
    rows.push(row)
  }

  const csvContent = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `grade-${entityName}-semana-${week}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
