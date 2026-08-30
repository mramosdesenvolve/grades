import { TIME_SLOTS } from '../../data/seed'
import { WEEKDAYS } from '../../types'
import type { ClassGroup, ScheduleEntry, Weekday } from '../../types'
import { useApp } from '../../context/AppContext'

function ClassGridBlock({ classGroup }: { classGroup: ClassGroup }) {
  const { data } = useApp()
  const slots = TIME_SLOTS.filter((s) => s.shift === classGroup.shift)
  const classEntries = data.schedule.filter(
    (e) => e.type === 'aula' && e.classId === classGroup.id,
  )

  const cellEntries = (day: Weekday, timeSlotId: string) =>
    classEntries.filter((e) => e.day === day && e.timeSlotId === timeSlotId)

  const cellText = (entry: ScheduleEntry) => {
    const comp = data.components.find((c) => c.id === entry.componentId)
    const teacher = data.teachers.find((t) => t.id === entry.teacherId)
    return { comp, teacher }
  }

  return (
    <div className="print-grid-item">
      <h3 className="mb-1 text-[11px] font-bold text-slate-800">
        {classGroup.name} · {classGroup.shift}
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
          {slots.map((slot) => (
            <tr key={slot.id}>
              <td className="border border-slate-300 px-1 py-0.5 font-medium">{slot.label}</td>
              {WEEKDAYS.map((day) => {
                const entries = cellEntries(day, slot.id)
                return (
                  <td key={day} className="border border-slate-300 px-1 py-0.5 align-top">
                    {entries.length === 0 && <span className="text-slate-300">—</span>}
                    {entries.map((entry) => {
                      const { comp, teacher } = cellText(entry)
                      return (
                        <div key={entry.id} className="leading-tight">
                          <span className="font-semibold" style={{ color: comp?.color }}>
                            {comp?.name}
                          </span>
                          {entry.week !== 'AMBAS' && (
                            <span className="ml-0.5 rounded bg-slate-200 px-0.5">
                              {entry.week}
                            </span>
                          )}
                          <div className="text-slate-500">{teacher?.name}</div>
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

export function PrintAllGrids({ schoolId }: { schoolId: string }) {
  const { data } = useApp()
  const schoolName = data.schools.find((s) => s.id === schoolId)?.name ?? ''
  const classes = data.classes.filter((c) => c.schoolId === schoolId)

  return (
    <div className="print-multi-grid">
      {classes.map((c, i) => (
        <div key={c.id} className={i % 2 === 1 ? 'print-page-break' : ''}>
          {i % 2 === 0 && (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Grade de Horários — {schoolName}
            </p>
          )}
          <ClassGridBlock classGroup={c} />
        </div>
      ))}
      {classes.length === 0 && <p>Nenhuma turma cadastrada nesta unidade.</p>}
    </div>
  )
}
