import { useApp } from '../../context/AppContext'
import type { ScheduleEntry, Teacher } from '../../types'
import { teacherChargeReport } from '../../utils/teacherReport'
import { entryWeight } from '../../utils/conflicts'
import { fmtHours } from '../../utils/format'

function TeacherReportBlock({ teacher }: { teacher: Teacher }) {
  const { data } = useApp()
  const entries = data.schedule.filter((e) => e.teacherId === teacher.id)
  const regenciaEntries = entries.filter((e): e is ScheduleEntry & { classId: string } =>
    Boolean(e.type === 'aula' && e.classId),
  )
  const planningEntries = entries.filter(
    (e) => e.type === 'planejamento' || e.type === 'orientacao',
  )

  const { regencia: regenciaTotal, planejamento: planningTotal, planejamentoLabel, saldo } =
    teacherChargeReport(teacher, data.schedule)

  // agrupa regência por componente + turma (tempos quinzenais valem 0,5 aula/semana)
  const groups = new Map<string, { comp: string; className: string; count: number }>()
  for (const e of regenciaEntries) {
    const comp = data.components.find((c) => c.id === e.componentId)?.name ?? '?'
    const className = data.classes.find((c) => c.id === e.classId)?.name ?? '?'
    const key = `${comp}::${className}`
    const existing = groups.get(key)
    if (existing) existing.count += entryWeight(e)
    else groups.set(key, { comp, className, count: entryWeight(e) })
  }

  // agrupa planejamento/orientação por componente (Orientação não tem componente)
  const planningGroups = new Map<string, number>()
  for (const e of planningEntries) {
    const label =
      e.type === 'orientacao' ? 'Orientação' : (data.components.find((c) => c.id === e.componentId)?.name ?? '?')
    planningGroups.set(label, (planningGroups.get(label) ?? 0) + entryWeight(e))
  }

  return (
    <section className="report-teacher-block mb-4 break-inside-avoid rounded border border-slate-300 p-3">
      <h2 className="text-sm font-bold text-slate-800">
        {teacher.name}
        {teacher.isOrientador && (
          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-semibold text-violet-700">
            Professor Orientador
          </span>
        )}
      </h2>

      <table className="mt-2 w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-left">
              Componente
            </th>
            <th className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-left">Turma</th>
            <th className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-right">
              Aulas/semana
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from(groups.values()).map((g) => (
            <tr key={`${g.comp}::${g.className}`}>
              <td className="border border-slate-300 px-1.5 py-1">{g.comp}</td>
              <td className="border border-slate-300 px-1.5 py-1">{g.className}</td>
              <td className="border border-slate-300 px-1.5 py-1 text-right">
                {fmtHours(g.count)}
              </td>
            </tr>
          ))}
          {planningGroups.size > 0 &&
            Array.from(planningGroups.entries()).map(([comp, count]) => (
              <tr key={`plan::${comp}`}>
                <td className="border border-slate-300 px-1.5 py-1">{comp}</td>
                <td className="border border-slate-300 px-1.5 py-1 italic text-slate-500">
                  {comp === 'Orientação' ? '—' : 'Planejamento'}
                </td>
                <td className="border border-slate-300 px-1.5 py-1 text-right">
                  {fmtHours(count)}
                </td>
              </tr>
            ))}
          {groups.size === 0 && planningGroups.size === 0 && (
            <tr>
              <td colSpan={3} className="border border-slate-300 px-1.5 py-1 text-slate-400">
                Nenhuma alocação na grade.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {teacher.isOrientador && (
        <p className="mt-1 text-[9px] italic text-slate-400">
          Professor Orientador: o total-alvo é {teacher.orientadorTargetHours}h. O que estiver
          lançado na grade como Planejamento ou Orientação conta acima; o restante até o
          total-alvo é carga administrativa presumida.
        </p>
      )}

      <div className="mt-2 grid grid-cols-4 gap-2 text-[10px]">
        <div className="rounded bg-slate-50 px-2 py-1">
          <p className="font-semibold text-slate-700">{teacher.contractedHours2026}h</p>
          <p className="text-slate-400">Contratado 2026</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1">
          <p className="font-semibold text-slate-700">{fmtHours(regenciaTotal)}h</p>
          <p className="text-slate-400">Regência 2027</p>
        </div>
        <div className="rounded bg-slate-50 px-2 py-1">
          <p className="font-semibold text-slate-700">{fmtHours(planningTotal)}h</p>
          <p className="text-slate-400">{planejamentoLabel} 2027</p>
        </div>
        <div
          className={`rounded px-2 py-1 ${
            saldo > 0 ? 'bg-red-50' : saldo < 0 ? 'bg-amber-50' : 'bg-emerald-50'
          }`}
        >
          <p
            className={`font-semibold ${
              saldo > 0 ? 'text-red-600' : saldo < 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {saldo > 0 ? `+${fmtHours(saldo)}h` : `${fmtHours(saldo)}h`}
          </p>
          <p className="text-slate-400">Saldo (2027 − 2026)</p>
        </div>
      </div>
    </section>
  )
}

export function PrintTeacherReport({ schoolId }: { schoolId: string }) {
  const { data } = useApp()
  const schoolName = data.schools.find((s) => s.id === schoolId)?.name ?? ''
  const teachers = data.teachers
    .filter((t) => t.schoolId === schoolId)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="print-report">
      <h1 className="mb-4 text-lg font-bold text-slate-800">
        Relatório de Carga Horária — {schoolName}
      </h1>
      {teachers.map((t) => (
        <TeacherReportBlock key={t.id} teacher={t} />
      ))}
      {teachers.length === 0 && <p>Nenhum professor cadastrado nesta unidade.</p>}
    </div>
  )
}
