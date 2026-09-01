import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react'
import { Modal } from '../common/Modal'
import { useApp } from '../../context/AppContext'
import type { ScheduleEntry, WeekType, Weekday } from '../../types'
import { TIME_SLOTS } from '../../data/seed'

type Mode = 'class' | 'teacher' | 'planning'

export function AssignModal({
  mode,
  entityId,
  day,
  timeSlotId,
  week,
  existing,
  onClose,
  lockComponent = false,
}: {
  mode: Mode
  entityId: string
  day: Weekday
  timeSlotId: string
  week: WeekType
  existing: ScheduleEntry | null
  onClose: () => void
  /** trava o componente curricular (não editável) — usado ao abrir a partir
   * da grade "Por Componente", onde a intenção é só trocar o professor */
  lockComponent?: boolean
}) {
  const { data, activeSchoolId, upsertScheduleEntry, removeScheduleEntry, beginBatch, commitBatch } =
    useApp()
  const schoolTeachers = data.teachers.filter((t) => t.schoolId === activeSchoolId)
  const schoolClasses = data.classes.filter((c) => c.schoolId === activeSchoolId)
  const slot = TIME_SLOTS.find((s) => s.id === timeSlotId)!
  const teacherId = mode === 'class' ? undefined : entityId

  const [componentId, setComponentId] = useState(existing?.componentId ?? '')
  const [secondaryId, setSecondaryId] = useState(
    mode === 'class' ? (existing?.teacherId ?? '') : (existing?.classId ?? ''),
  )
  const [entryWeek, setEntryWeek] = useState<WeekType>(existing?.week ?? week)
  const [planningKind, setPlanningKind] = useState<'componente' | 'orientacao'>(
    existing?.type === 'orientacao' ? 'orientacao' : 'componente',
  )

  const planningTeacher = mode === 'planning' ? data.teachers.find((t) => t.id === entityId) : null
  const canMarkOrientacao = mode === 'planning' && !!planningTeacher?.isOrientador

  const availableComponents = useMemo(() => {
    if (mode === 'teacher' || mode === 'planning') {
      const teacher = data.teachers.find((t) => t.id === entityId)
      return data.components.filter((c) => teacher?.componentIds.includes(c.id))
    }
    return data.components
  }, [data.components, data.teachers, entityId, mode])

  const availableSecondary = useMemo(() => {
    if (mode === 'class') {
      // professores da unidade vinculados ao componente escolhido
      if (!componentId) return schoolTeachers
      return schoolTeachers.filter((t) => t.componentIds.includes(componentId))
    }
    return schoolClasses
  }, [schoolTeachers, schoolClasses, componentId, mode])

  const resolvedTeacherId = mode === 'class' ? secondaryId : teacherId

  const overlaps = (a: WeekType, b: WeekType) => a === b || a === 'AMBAS' || b === 'AMBAS'

  const wouldConflict = useMemo(() => {
    if (!resolvedTeacherId) return false
    return data.schedule.some(
      (e) =>
        e.id !== existing?.id &&
        e.teacherId === resolvedTeacherId &&
        e.day === day &&
        e.timeSlotId === timeSlotId &&
        overlaps(e.week, entryWeek),
    )
  }, [data.schedule, resolvedTeacherId, day, timeSlotId, entryWeek, existing])

  // co-docência (só em "Por Turma"): outros professores já lançados neste
  // mesmo horário/turma além do principal — ex: um de LET (técnico) e um
  // de formação geral básica, juntos.
  const siblingEntries = data.schedule.filter(
    (e) =>
      mode === 'class' &&
      e.type === 'aula' &&
      e.classId === entityId &&
      e.day === day &&
      e.timeSlotId === timeSlotId &&
      e.id !== existing?.id,
  )
  const [addingCoTeacher, setAddingCoTeacher] = useState(false)
  const [coTeacherId, setCoTeacherId] = useState('')

  const usedTeacherIds = new Set([secondaryId, ...siblingEntries.map((e) => e.teacherId)])
  const availableCoTeachers = availableSecondary.filter(
    (t) => mode === 'class' && !usedTeacherIds.has(t.id),
  )

  const coTeacherWouldConflict = useMemo(() => {
    if (!coTeacherId) return false
    return data.schedule.some(
      (e) => e.teacherId === coTeacherId && e.day === day && e.timeSlotId === timeSlotId && overlaps(e.week, entryWeek),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.schedule, coTeacherId, day, timeSlotId, entryWeek])

  const handleSave = async () => {
    if (mode === 'planning') {
      if (canMarkOrientacao && planningKind === 'orientacao') {
        upsertScheduleEntry({
          id: existing?.id,
          type: 'orientacao',
          day,
          timeSlotId,
          week: entryWeek,
          teacherId: entityId,
        })
        onClose()
        return
      }
      if (!componentId) return
      upsertScheduleEntry({
        id: existing?.id,
        type: 'planejamento',
        day,
        timeSlotId,
        week: entryWeek,
        componentId,
        teacherId: entityId,
      })
      onClose()
      return
    }
    if (!componentId || !secondaryId) return
    const finalTeacherId = mode === 'class' ? secondaryId : entityId
    const classId = mode === 'class' ? entityId : secondaryId

    const addCoTeacher = mode === 'class' && addingCoTeacher && !!coTeacherId
    if (addCoTeacher) beginBatch()

    await upsertScheduleEntry({
      id: existing?.id,
      type: 'aula',
      day,
      timeSlotId,
      week: entryWeek,
      classId,
      componentId,
      teacherId: finalTeacherId,
    })

    if (addCoTeacher) {
      await upsertScheduleEntry({
        type: 'aula',
        day,
        timeSlotId,
        week: entryWeek,
        classId,
        componentId,
        teacherId: coTeacherId,
      })
      commitBatch('Adicionar professor junto')
    }
    onClose()
  }

  const isOrientacaoEntry = mode === 'planning' && canMarkOrientacao && planningKind === 'orientacao'
  const canSave = mode === 'planning'
    ? isOrientacaoEntry || !!componentId
    : !!componentId && !!secondaryId

  return (
    <Modal title={`${day} · ${slot.label} (${slot.shift})`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Semana</label>
          <div className="flex gap-2">
            {(['A', 'B', 'AMBAS'] as WeekType[]).map((w) => (
              <button
                key={w}
                onClick={() => setEntryWeek(w)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  entryWeek === w
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {w === 'AMBAS' ? 'Ambas' : `Semana ${w}`}
              </button>
            ))}
          </div>
        </div>

        {canMarkOrientacao && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlanningKind('componente')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  planningKind === 'componente'
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Planejamento
              </button>
              <button
                type="button"
                onClick={() => setPlanningKind('orientacao')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  planningKind === 'orientacao'
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Orientação
              </button>
            </div>
          </div>
        )}

        {!isOrientacaoEntry && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Componente Curricular
            </label>
            <select
              value={componentId}
              disabled={lockComponent}
              onChange={(e) => {
                setComponentId(e.target.value)
                setSecondaryId('')
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">Selecione...</option>
              {availableComponents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode !== 'planning' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {mode === 'class' ? 'Professor' : 'Turma'}
            </label>
            <select
              value={secondaryId}
              onChange={(e) => setSecondaryId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Selecione...</option>
              {availableSecondary.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {wouldConflict && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Conflito: este professor já está ocupado (aula ou planejamento) neste
              dia/horário/semana.
            </span>
          </div>
        )}

        {mode === 'class' && !isOrientacaoEntry && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Professor(es) junto (co-docência)
            </label>
            <div className="space-y-1.5">
              {siblingEntries.map((sib) => {
                const t = data.teachers.find((x) => x.id === sib.teacherId)
                return (
                  <div
                    key={sib.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-700">
                      {t?.name}
                      {sib.week !== 'AMBAS' && (
                        <span className="ml-1.5 rounded bg-slate-200 px-1 text-[10px] font-medium text-slate-600">
                          Semana {sib.week}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeScheduleEntry(sib.id)}
                      className="text-slate-400 hover:text-red-600"
                      title="Remover este professor deste horário"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )
              })}

              {addingCoTeacher ? (
                <div className="space-y-2 rounded-lg border border-slate-200 p-2">
                  <select
                    value={coTeacherId}
                    onChange={(e) => setCoTeacherId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    autoFocus
                  >
                    <option value="">Selecione o segundo professor...</option>
                    {availableCoTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {coTeacherWouldConflict && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>Conflito: este professor já está ocupado neste dia/horário/semana.</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCoTeacher(false)
                      setCoTeacherId('')
                    }}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingCoTeacher(true)}
                  disabled={!componentId}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={13} /> Adicionar professor junto
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Ex: um professor de LET (técnico) e um de formação geral básica no mesmo horário.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-between gap-2">
        {existing ? (
          <button
            onClick={() => {
              removeScheduleEntry(existing.id)
              onClose()
            }}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} /> Remover
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  )
}
