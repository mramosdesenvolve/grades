import { useMemo, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
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
  const { data, activeSchoolId, upsertScheduleEntry, removeScheduleEntry } = useApp()
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

  const wouldConflict = useMemo(() => {
    if (!resolvedTeacherId) return false
    const overlaps = (a: WeekType, b: WeekType) => a === b || a === 'AMBAS' || b === 'AMBAS'
    return data.schedule.some(
      (e) =>
        e.id !== existing?.id &&
        e.teacherId === resolvedTeacherId &&
        e.day === day &&
        e.timeSlotId === timeSlotId &&
        overlaps(e.week, entryWeek),
    )
  }, [data.schedule, resolvedTeacherId, day, timeSlotId, entryWeek, existing])

  const handleSave = () => {
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
    upsertScheduleEntry({
      id: existing?.id,
      type: 'aula',
      day,
      timeSlotId,
      week: entryWeek,
      classId,
      componentId,
      teacherId: finalTeacherId,
    })
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
