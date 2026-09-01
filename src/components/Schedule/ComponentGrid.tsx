import { Fragment, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { TIME_SLOTS } from '../../data/seed'
import { WEEKDAYS } from '../../types'
import type { Shift, WeekType, ScheduleEntry } from '../../types'
import { useApp } from '../../context/AppContext'
import { AssignModal } from './AssignModal'

// paleta estável para distinguir professores diferentes cobrindo o mesmo
// componente (ex: Matemática dividida entre várias turmas/professores)
const TEACHER_PALETTE = [
  '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#c026d3', '#65a30d', '#e11d48', '#0284c7',
]

/**
 * Grade completa de UM componente curricular, somando todas as turmas e
 * todos os professores que o lecionam na unidade — útil quando o
 * componente é dividido entre vários professores (ex: Matemática por
 * trilha) e não existe uma única "grade do professor" que mostre tudo.
 */
export function ComponentGrid({ componentId, week }: { componentId: string; week: WeekType }) {
  const { data, conflicts, activeSchoolId } = useApp()
  const [target, setTarget] = useState<ScheduleEntry | null>(null)

  // components é uma tabela global (o mesmo id de "Matemática" é usado nas
  // 4 unidades) — sem filtrar por schoolId aqui, a grade misturaria aulas
  // de outras unidades.
  const entries = data.schedule.filter(
    (e) => e.componentId === componentId && e.type === 'aula' && e.schoolId === activeSchoolId,
  )

  const teacherIds = Array.from(new Set(entries.map((e) => e.teacherId)))
  const colorForTeacher = (teacherId: string) =>
    TEACHER_PALETTE[teacherIds.indexOf(teacherId) % TEACHER_PALETTE.length]

  const usedShifts = new Set(
    entries
      .map((e) => TIME_SLOTS.find((s) => s.id === e.timeSlotId)?.shift)
      .filter((s): s is Shift => Boolean(s)),
  )
  const slots = TIME_SLOTS.filter((s) => usedShifts.size === 0 || usedShifts.has(s.shift))

  const cellEntries = (day: string, timeSlotId: string) =>
    entries.filter(
      (e) =>
        e.day === day &&
        e.timeSlotId === timeSlotId &&
        (week === 'AMBAS' || e.week === week || e.week === 'AMBAS'),
    )

  let lastShift: Shift | null = null

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      {teacherIds.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-2.5">
          {teacherIds.map((tid) => {
            const teacher = data.teachers.find((t) => t.id === tid)
            return (
              <span key={tid} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorForTeacher(tid) }}
                />
                {teacher?.name ?? '?'}
              </span>
            )
          })}
        </div>
      )}
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-28 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">
              Horário
            </th>
            {WEEKDAYS.map((d) => (
              <th
                key={d}
                className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const showShiftHeader = slot.shift !== lastShift
            lastShift = slot.shift
            return (
              <Fragment key={slot.id}>
                {showShiftHeader && (
                  <tr key={`${slot.shift}-header`}>
                    <td
                      colSpan={WEEKDAYS.length + 1}
                      className="bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {slot.shift}
                    </td>
                  </tr>
                )}
                <tr className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 align-top text-xs font-medium text-slate-500">
                    {slot.label}
                  </td>
                  {WEEKDAYS.map((day) => {
                    const cell = cellEntries(day, slot.id)
                    return (
                      <td key={day} className="p-1.5 align-top">
                        <div className="flex min-h-[3rem] w-full flex-col gap-1 rounded-lg border border-transparent px-1 py-1">
                          {cell.length === 0 && <span className="px-1 text-slate-200">—</span>}
                          {cell.map((entry: ScheduleEntry) => {
                            const isConflict = conflicts.has(entry.id)
                            const cls = data.classes.find((c) => c.id === entry.classId)
                            const teacher = data.teachers.find((t) => t.id === entry.teacherId)
                            return (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => setTarget(entry)}
                                title="Clique para trocar o professor responsável"
                                className={`flex items-baseline gap-1 rounded px-1.5 py-0.5 text-left transition-opacity hover:opacity-80 ${
                                  isConflict ? 'border border-red-400 bg-red-50' : ''
                                }`}
                                style={
                                  !isConflict
                                    ? { backgroundColor: `${colorForTeacher(entry.teacherId)}1a` }
                                    : undefined
                                }
                              >
                                {isConflict && (
                                  <AlertTriangle size={11} className="mt-0.5 shrink-0 text-red-500" />
                                )}
                                {entry.week !== 'AMBAS' && (
                                  <span className="shrink-0 rounded bg-slate-700 px-1 text-[9px] font-semibold text-white">
                                    {entry.week}
                                  </span>
                                )}
                                <span
                                  className="truncate text-[11px] font-semibold"
                                  style={{ color: isConflict ? '#dc2626' : colorForTeacher(entry.teacherId) }}
                                >
                                  {cls?.name ?? '?'}
                                </span>
                                <span className="truncate text-[10px] text-slate-500">
                                  {teacher?.name}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {target && target.classId && (
        <AssignModal
          mode="class"
          entityId={target.classId}
          day={target.day}
          timeSlotId={target.timeSlotId}
          week={target.week}
          existing={target}
          lockComponent
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  )
}
