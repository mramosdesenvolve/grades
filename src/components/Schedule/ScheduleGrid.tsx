import { Fragment, useState } from 'react'
import { Plus } from 'lucide-react'
import { TIME_SLOTS } from '../../data/seed'
import { WEEKDAYS } from '../../types'
import type { Shift, WeekType, Weekday, ScheduleEntry } from '../../types'
import { useApp } from '../../context/AppContext'
import { AssignModal } from './AssignModal'

export function ScheduleGrid({
  mode,
  entityId,
  week,
  shiftFilter,
}: {
  mode: 'class' | 'teacher' | 'planning'
  entityId: string
  week: WeekType
  shiftFilter?: Shift
}) {
  const { data, conflicts, upsertScheduleEntry } = useApp()
  const [target, setTarget] = useState<{
    day: Weekday
    timeSlotId: string
    week: WeekType
    existing: ScheduleEntry | null
  } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const slots = shiftFilter ? TIME_SLOTS.filter((s) => s.shift === shiftFilter) : TIME_SLOTS

  const handleDrop = (day: Weekday, timeSlotId: string, targetEntry: ScheduleEntry | null) => {
    setDragOverKey(null)
    if (!draggingId) return
    const sourceId = draggingId
    setDraggingId(null)
    const source = data.schedule.find((e) => e.id === sourceId)
    if (!source) return
    if (source.day === day && source.timeSlotId === timeSlotId) return
    if (targetEntry && targetEntry.id === source.id) return

    const { id: sourceEntryId, schoolId: _s1, ...sourceRest } = source
    upsertScheduleEntry({ ...sourceRest, id: sourceEntryId, day, timeSlotId })

    if (targetEntry) {
      const { id: targetEntryId, schoolId: _s2, ...targetRest } = targetEntry
      upsertScheduleEntry({
        ...targetRest,
        id: targetEntryId,
        day: source.day,
        timeSlotId: source.timeSlotId,
      })
    }
  }

  const findEntries = (day: Weekday, timeSlotId: string) =>
    data.schedule.filter((e) => {
      const matchesEntity = mode === 'class' ? e.classId === entityId : e.teacherId === entityId
      const matchesType =
        mode === 'planning' ? e.type === 'planejamento' || e.type === 'orientacao' : e.type === 'aula'
      const matchesWeek = week === 'AMBAS' ? true : e.week === week || e.week === 'AMBAS'
      return (
        matchesEntity && matchesType && e.day === day && e.timeSlotId === timeSlotId && matchesWeek
      )
    })

  const ORIENTACAO_COLOR = '#7c3aed'
  const entryDisplay = (entry: ScheduleEntry) => {
    if (entry.type === 'orientacao') return { name: 'Orientação', color: ORIENTACAO_COLOR }
    const comp = data.components.find((c) => c.id === entry.componentId)
    return { name: comp?.name ?? '?', color: comp?.color ?? '#64748b' }
  }

  // Na visão de Planejamento, mostra a regência do professor como referência
  // visual (não editável) nos horários onde ele ainda não tem planejamento.
  const findRegenciaRef = (day: Weekday, timeSlotId: string) => {
    if (mode !== 'planning') return []
    return data.schedule.filter((e) => {
      const matchesWeek = week === 'AMBAS' ? true : e.week === week || e.week === 'AMBAS'
      return (
        e.type === 'aula' &&
        e.teacherId === entityId &&
        e.day === day &&
        e.timeSlotId === timeSlotId &&
        matchesWeek
      )
    })
  }

  let lastShift: Shift | null = null

  const entryLabel = (entry: ScheduleEntry) =>
    mode === 'class'
      ? data.teachers.find((t) => t.id === entry.teacherId)?.name
      : mode === 'teacher'
        ? data.classes.find((c) => c.id === entry.classId)?.name
        : entry.type === 'orientacao'
          ? ''
          : 'Planejamento'

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
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
                  <tr key={`${slot.shift}-header`} className="print:hidden">
                    <td
                      colSpan={WEEKDAYS.length + 1}
                      className="bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {slot.shift}
                    </td>
                  </tr>
                )}
                <tr key={slot.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 align-top text-xs font-medium text-slate-500">
                    {slot.label}
                  </td>
                  {WEEKDAYS.map((day) => {
                    const entries = findEntries(day, slot.id)
                    const isSplit =
                      week === 'AMBAS' &&
                      entries.length === 2 &&
                      entries.some((e) => e.week === 'A') &&
                      entries.some((e) => e.week === 'B')

                    if (isSplit) {
                      const entryA = entries.find((e) => e.week === 'A')!
                      const entryB = entries.find((e) => e.week === 'B')!
                      return (
                        <td key={day} className="p-1.5 align-top">
                          <div className="flex h-16 w-full flex-col overflow-hidden rounded-lg border border-transparent print:h-auto print:min-h-[3rem]">
                            {[entryA, entryB].map((entry) => {
                              const isConflict = conflicts.has(entry.id)
                              const component = entryDisplay(entry)
                              const dropKey = `${day}::${slot.id}::${entry.week}`
                              return (
                                <button
                                  key={entry.id}
                                  draggable
                                  onDragStart={() => setDraggingId(entry.id)}
                                  onDragEnd={() => {
                                    setDraggingId(null)
                                    setDragOverKey(null)
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    setDragOverKey(dropKey)
                                  }}
                                  onDragLeave={() =>
                                    setDragOverKey((k) => (k === dropKey ? null : k))
                                  }
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    handleDrop(day, slot.id, entry)
                                  }}
                                  onClick={() =>
                                    setTarget({
                                      day,
                                      timeSlotId: slot.id,
                                      week: entry.week,
                                      existing: entry,
                                    })
                                  }
                                  className={`flex h-1/2 w-full cursor-grab flex-col justify-center px-2 py-0.5 text-left transition-colors first:border-b first:border-white hover:opacity-90 active:cursor-grabbing ${
                                    isConflict ? 'border-red-400 bg-red-50' : ''
                                  } ${dragOverKey === dropKey ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                                  style={!isConflict ? { backgroundColor: `${component?.color}1a` } : undefined}
                                >
                                  <span className="flex items-baseline gap-1">
                                    <span
                                      className="w-fit shrink-0 rounded bg-slate-700 px-1 text-[9px] font-semibold text-white"
                                    >
                                      {entry.week}
                                    </span>
                                    <span
                                      className="truncate text-[11px] font-semibold"
                                      style={{ color: isConflict ? '#dc2626' : component?.color }}
                                    >
                                      {component?.name}
                                    </span>
                                  </span>
                                  <span className="truncate pl-4 text-[10px] text-slate-500">
                                    {entryLabel(entry)}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </td>
                      )
                    }

                    const entry = entries[0]

                    // Planejamento + Ambas: quando a regência só ocupa uma
                    // das semanas naquele horário, divide a célula para que
                    // a semana livre fique disponível para planejamento.
                    if (mode === 'planning' && week === 'AMBAS' && !isSplit) {
                      const regenciaEntries = findRegenciaRef(day, slot.id)
                      const regOnA = regenciaEntries.some((r) => r.week === 'A' || r.week === 'AMBAS')
                      const regOnB = regenciaEntries.some((r) => r.week === 'B' || r.week === 'AMBAS')
                      if (regenciaEntries.length > 0 && !(regOnA && regOnB)) {
                        const halfFor = (w: 'A' | 'B') => {
                          if (entry && (entry.week === w || entry.week === 'AMBAS')) {
                            return { kind: 'planning' as const, e: entry }
                          }
                          const reg = regenciaEntries.find((r) => r.week === w || r.week === 'AMBAS')
                          if (reg) return { kind: 'regencia' as const, e: reg }
                          return { kind: 'empty' as const, e: null }
                        }
                        return (
                          <td key={day} className="p-1.5 align-top">
                            <div className="flex h-16 w-full flex-col overflow-hidden rounded-lg border border-transparent print:h-auto print:min-h-[3rem]">
                              {(['A', 'B'] as const).map((w) => {
                                const half = halfFor(w)
                                const dropKey = `${day}::${slot.id}::${w}`
                                if (half.kind === 'planning') {
                                  const pe = half.e
                                  const isConflict = conflicts.has(pe.id)
                                  const component = entryDisplay(pe)
                                  return (
                                    <button
                                      key={w}
                                      draggable
                                      onDragStart={() => setDraggingId(pe.id)}
                                      onDragEnd={() => {
                                        setDraggingId(null)
                                        setDragOverKey(null)
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault()
                                        setDragOverKey(dropKey)
                                      }}
                                      onDragLeave={() =>
                                        setDragOverKey((k) => (k === dropKey ? null : k))
                                      }
                                      onDrop={(e) => {
                                        e.preventDefault()
                                        handleDrop(day, slot.id, pe)
                                      }}
                                      onClick={() =>
                                        setTarget({
                                          day,
                                          timeSlotId: slot.id,
                                          week: pe.week,
                                          existing: pe,
                                        })
                                      }
                                      className={`flex h-1/2 w-full cursor-grab items-baseline gap-1 overflow-hidden px-2 py-0.5 text-left transition-colors first:border-b first:border-white hover:opacity-90 active:cursor-grabbing ${
                                        isConflict ? 'border-red-400 bg-red-50' : ''
                                      } ${dragOverKey === dropKey ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                                      style={
                                        !isConflict
                                          ? { backgroundColor: `${component?.color}1a` }
                                          : undefined
                                      }
                                    >
                                      <span className="w-fit shrink-0 rounded bg-slate-700 px-1 text-[9px] font-semibold text-white">
                                        {pe.week === 'AMBAS' ? 'Amb' : pe.week}
                                      </span>
                                      <span
                                        className="truncate text-[11px] font-semibold"
                                        style={{ color: isConflict ? '#dc2626' : component?.color }}
                                      >
                                        {component?.name}
                                      </span>
                                      {pe.type !== 'orientacao' && (
                                        <span className="truncate text-[9px] italic text-slate-400">
                                          (Planej.)
                                        </span>
                                      )}
                                    </button>
                                  )
                                }
                                if (half.kind === 'regencia') {
                                  const re = half.e
                                  const rComp = data.components.find((c) => c.id === re.componentId)
                                  const rClass = data.classes.find((c) => c.id === re.classId)
                                  return (
                                    <div
                                      key={w}
                                      className="flex h-1/2 w-full items-baseline gap-1 overflow-hidden bg-slate-50 px-2 py-0.5 first:border-b first:border-white"
                                    >
                                      <span className="shrink-0 rounded bg-slate-300 px-1 text-[9px] font-semibold text-slate-600">
                                        Regência
                                      </span>
                                      <span className="shrink-0 rounded bg-slate-700 px-1 text-[9px] font-semibold text-white">
                                        {w}
                                      </span>
                                      <span className="truncate text-[10px] font-medium text-slate-500">
                                        {rComp?.name} · {rClass?.name}
                                      </span>
                                    </div>
                                  )
                                }
                                return (
                                  <button
                                    key={w}
                                    onDragOver={(e) => {
                                      if (!draggingId) return
                                      e.preventDefault()
                                      setDragOverKey(dropKey)
                                    }}
                                    onDragLeave={() =>
                                      setDragOverKey((k) => (k === dropKey ? null : k))
                                    }
                                    onDrop={(e) => {
                                      e.preventDefault()
                                      handleDrop(day, slot.id, null)
                                    }}
                                    onClick={() =>
                                      setTarget({
                                        day,
                                        timeSlotId: slot.id,
                                        week: w,
                                        existing: null,
                                      })
                                    }
                                    className={`group flex h-1/2 w-full flex-col justify-center border-dashed px-2 py-0.5 text-left first:border-b hover:bg-brand-50/50 ${
                                      dragOverKey === dropKey ? 'ring-2 ring-inset ring-brand-500' : ''
                                    }`}
                                  >
                                    <span className="flex items-center gap-1 text-[10px] text-slate-300">
                                      <span className="shrink-0 rounded bg-slate-200 px-1 text-[9px] font-semibold text-slate-500">
                                        {w}
                                      </span>
                                      <Plus
                                        size={11}
                                        className="opacity-0 group-hover:opacity-100 print:hidden"
                                      />
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </td>
                        )
                      }
                    }

                    const isConflict = entry ? conflicts.has(entry.id) : false
                    const component = entry ? entryDisplay(entry) : undefined
                    const label = entry ? entryLabel(entry) : undefined
                    const dropKey = `${day}::${slot.id}`
                    const regenciaRef = entry ? [] : findRegenciaRef(day, slot.id)

                    return (
                      <td key={day} className="p-1.5 align-top">
                        <button
                          draggable={!!entry}
                          onDragStart={() => entry && setDraggingId(entry.id)}
                          onDragEnd={() => {
                            setDraggingId(null)
                            setDragOverKey(null)
                          }}
                          onDragOver={(e) => {
                            if (!draggingId) return
                            e.preventDefault()
                            setDragOverKey(dropKey)
                          }}
                          onDragLeave={() => setDragOverKey((k) => (k === dropKey ? null : k))}
                          onDrop={(e) => {
                            e.preventDefault()
                            handleDrop(day, slot.id, entry ?? null)
                          }}
                          onClick={() =>
                            setTarget({
                              day,
                              timeSlotId: slot.id,
                              week: entry?.week ?? week,
                              existing: entry ?? null,
                            })
                          }
                          className={`group flex h-16 w-full flex-col justify-center rounded-lg border px-2 py-1.5 text-left transition-colors print:h-auto print:min-h-[3rem] ${
                            entry ? 'cursor-grab active:cursor-grabbing' : ''
                          } ${
                            entry
                              ? isConflict
                                ? 'border-red-400 bg-red-50 hover:bg-red-100'
                                : 'border-transparent hover:opacity-90'
                              : regenciaRef.length > 0
                                ? 'border-dashed border-slate-300 bg-slate-50 hover:border-brand-300'
                                : 'border-dashed border-slate-200 hover:border-brand-300 hover:bg-brand-50/50'
                          } ${dragOverKey === dropKey ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                          style={
                            entry && !isConflict
                              ? { backgroundColor: `${component?.color}1a` }
                              : undefined
                          }
                        >
                          {entry ? (
                            <>
                              <span
                                className="truncate text-xs font-semibold"
                                style={{ color: isConflict ? '#dc2626' : component?.color }}
                              >
                                {component?.name}
                              </span>
                              <span className="truncate text-[11px] text-slate-500">{label}</span>
                              {entry.week !== 'AMBAS' && (
                                <span className="mt-0.5 w-fit rounded bg-slate-200 px-1 text-[10px] font-medium text-slate-600">
                                  Semana {entry.week}
                                </span>
                              )}
                            </>
                          ) : regenciaRef.length > 0 ? (
                            <div className="flex w-full flex-col gap-0.5">
                              {regenciaRef.map((r) => {
                                const rComp = data.components.find((c) => c.id === r.componentId)
                                const rClass = data.classes.find((c) => c.id === r.classId)
                                return (
                                  <div key={r.id} className="flex items-baseline gap-1">
                                    <span className="shrink-0 rounded bg-slate-300 px-1 text-[9px] font-semibold text-slate-600">
                                      Regência
                                    </span>
                                    <span className="shrink-0 rounded bg-slate-700 px-1 text-[9px] font-semibold text-white">
                                      {r.week === 'AMBAS' ? 'Ambas' : r.week}
                                    </span>
                                    <span className="truncate text-[11px] font-medium text-slate-500">
                                      {rComp?.name} · {rClass?.name}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <Plus
                              size={14}
                              className="text-slate-300 opacity-0 group-hover:opacity-100 print:hidden"
                            />
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {target && (
        <AssignModal
          mode={mode}
          entityId={entityId}
          day={target.day}
          timeSlotId={target.timeSlotId}
          week={target.week}
          existing={target.existing}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  )
}
