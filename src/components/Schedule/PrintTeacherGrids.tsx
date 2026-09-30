import { TIME_SLOTS } from '../../data/seed'
import { WEEKDAYS } from '../../types'
import type { ScheduleEntry, Teacher, Weekday } from '../../types'
import { useApp } from '../../context/AppContext'

function TeacherGridBlock({ teacher }: { teacher: Teacher }) {
  const { data } = useApp()
  const teacherEntries = data.schedule.filter((e) => e.teacherId === teacher.id)

  const cellEntries = (day: Weekday, timeSlotId: string) =>
    teacherEntries.filter((e) => e.day === day && e.timeSlotId === timeSlotId)

  const cellLabel = (entry: ScheduleEntry) => {
    if (entry.type === 'orientacao') {
      return { title: 'Orientação', subtitle: null, color: undefined }
    }
    const comp = data.components.find((c) => c.id === entry.componentId)
    if (entry.type === 'planejamento') {
      return { title: `Planejamento · ${comp?.name ?? '?'}`, subtitle: null, color: comp?.color }
    }
    const cls = data.classes.find((c) => c.id === entry.classId)
    return { title: comp?.name ?? '?', subtitle: cls?.name ?? '?', color: comp?.color }
  }

  return (
    <div className="print-grid-item">
      <h3 className="mb-1 text-[11px] font-bold text-slate-800">
        {teacher.name}
        {teacher.isOrientador && ' · Orientador'}
      </h3>
      <table className="w-full border-collapse text-[7px]">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-100 px-1 py-0.5 text-left">Hor.</th>
            {WEEKDAYS.map((d) => (
              <th key={d} className="border border-slate-300 bg-slate-100 px-1 py-0.5 text-left">
                {d.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((slot, i) => (
            <tr key={slot.id}>
              <td className="border border-slate-300 px-1 py-0.5 font-medium">
                {slot.label}
                {(i === 0 || TIME_SLOTS[i - 1].shift !== slot.shift) && (
                  <span className="ml-0.5 text-slate-400">({slot.shift.slice(0, 3)})</span>
                )}
              </td>
              {WEEKDAYS.map((day) => {
                const entries = cellEntries(day, slot.id)
                return (
                  <td key={day} className="border border-slate-300 px-1 py-0.5 align-top">
                    {entries.length === 0 && <span className="text-slate-300">—</span>}
                    {entries.map((entry) => {
                      const { title, subtitle, color } = cellLabel(entry)
                      return (
                        <div key={entry.id} className="leading-tight">
                          <span className="font-semibold" style={{ color }}>
                            {title}
                          </span>
                          {entry.week !== 'AMBAS' && (
                            <span className="ml-0.5 rounded bg-slate-200 px-0.5">
                              {entry.week}
                            </span>
                          )}
                          {subtitle && <div className="text-slate-500">{subtitle}</div>}
                        </div>
                      )
                    })}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const GRIDS_PER_PAGE = 3

/** Exporta em PDF, um bloco por professor, a grade completa (regência + planejamento) */
export function PrintTeacherGrids({ schoolId }: { schoolId: string }) {
  const { data } = useApp()
  const schoolName = data.schools.find((s) => s.id === schoolId)?.name ?? ''
  const teachers = data.teachers
    .filter((t) => t.schoolId === schoolId)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="print-multi-grid">
      {teachers.map((t, i) => (
        <div key={t.id} className={i % GRIDS_PER_PAGE === GRIDS_PER_PAGE - 1 ? 'print-page-break' : ''}>
          {i % GRIDS_PER_PAGE === 0 && (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Grade por Professor (Regência + Planejamento) — {schoolName}
            </p>
          )}
          <TeacherGridBlock teacher={t} />
        </div>
      ))}
      {teachers.length === 0 && <p>Nenhum professor cadastrado nesta unidade.</p>}
    </div>
  )
}
