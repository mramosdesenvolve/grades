import { Fragment, useState } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { TIME_SLOTS } from '../../data/seed'
import { WEEKDAYS } from '../../types'
import type { Shift, WeekType, Weekday, ScheduleEntry } from '../../types'
import { useApp } from '../../context/AppContext'
import { gapSlotKey } from '../../utils/conflicts'
import { AssignModal } from './AssignModal'

/** cada tempo dura 50 min; o rótulo guarda só o início ("07h15") */
function slotRange(label: string) {
  const [h, m] = label.split('h').map(Number)
  const end = h * 60 + m + 50
  const pad = (n: number) => String(n).padStart(2, '0')
  return { start: label, end: `${pad(Math.floor(end / 60))}h${pad(end % 60)}` }
}

/** pausas entre tempos (aparecem como uma faixa fina na grade): depois do 3º tempo de cada turno */
const BREAK_AFTER: Record<string, string> = {
  m3: 'Intervalo · 09h45 – 10h15',
  v3: 'Recreio · 15h30 – 16h00',
}

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
  const {
    data,
    conflicts,
    dailyOverloadEntries,
    lunchBreakViolations,
    gapSlots,
    upsertScheduleEntry,
    beginBatch,
    commitBatch,
    scheduleLocked,
    isAdmin,
  } = useApp()
  const editLocked = scheduleLocked && !isAdmin

  // conflito (mesmo professor em 2 lugares) tem prioridade visual sobre um
  // alerta trabalhista (excesso diário / sem almoço) — os dois nunca
  // precisam de estilos simultâneos na mesma célula.
  const alertLevelFor = (id: string): 'conflict' | 'labor' | null => {
    if (conflicts.has(id)) return 'conflict'
    if (dailyOverloadEntries.has(id) || lunchBreakViolations.has(id)) return 'labor'
    return null
  }
  // célula VAZIA (sem entrada) que representa um horário vago no meio do
  // turno de trabalho do professor — só faz sentido nas visões por professor
  const isGapCell = (day: Weekday, timeSlotId: string) =>
    mode !== 'class' &&
    (gapSlots.has(gapSlotKey(entityId, day, timeSlotId, 'A')) ||
      gapSlots.has(gapSlotKey(entityId, day, timeSlotId, 'B')))
  const laborAlertReason = (id: string) => {
    const reasons: string[] = []
    if (dailyOverloadEntries.has(id)) reasons.push('mais de 8 tempos neste dia (limite do sindicato)')
    if (lunchBreakViolations.has(id)) reasons.push('sem intervalo de almoço entre manhã e tarde')
    return reasons.join(' · ')
  }
  const [target, setTarget] = useState<{
    day: Weekday
    timeSlotId: string
    week: WeekType
    existing: ScheduleEntry | null
  } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const slots = shiftFilter ? TIME_SLOTS.filter((s) => s.shift === shiftFilter) : TIME_SLOTS

  const handleDrop = async (day: Weekday, timeSlotId: string, targetEntry: ScheduleEntry | null) => {
    setDragOverKey(null)
    if (editLocked) return
    if (!draggingId) return
    const sourceId = draggingId
    setDraggingId(null)
    const source = data.schedule.find((e) => e.id === sourceId)
    if (!source) return
    if (source.day === day && source.timeSlotId === timeSlotId) return
    if (targetEntry && targetEntry.id === source.id) return

    beginBatch()

    const { id: sourceEntryId, schoolId: _s1, ...sourceRest } = source
    await upsertScheduleEntry({ ...sourceRest, id: sourceEntryId, day, timeSlotId })

    if (targetEntry) {
      const { id: targetEntryId, schoolId: _s2, ...targetRest } = targetEntry
      await upsertScheduleEntry({
        ...targetRest,
        id: targetEntryId,
        day: source.day,
        timeSlotId: source.timeSlotId,
      })
    }

    commitBatch(targetEntry ? 'Trocar aulas de lugar' : 'Mover aula')
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
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 z-10 w-28 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">
              Horário
            </th>
            {WEEKDAYS.map((d) => (
              <th
                key={d}
                className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500"
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
                  <td className="px-3 py-1.5 align-top text-xs leading-tight text-slate-500">
                    <span className="block font-semibold text-brand-600">{slotRange(slot.label).start}</span>
                    {slotRange(slot.label).end}
                  </td>
                  {WEEKDAYS.map((day) => {
                    const entries = findEntries(day, slot.id)
                    const isSplit =
                      week === 'AMBAS' &&
                      entries.length === 2 &&
                      entries.some((e) => e.week === 'A') &&
                      entries.some((e) => e.week === 'B')

                    // Por Turma: permite co-docência — 2+ professores no
                    // mesmo horário (ex: LET com um professor de FTP e um
                    // de formação geral básica juntos). Mantém o caso
                    // clássico de alternância A/B (isSplit) como está.
                    if (mode === 'class' && !isSplit) {
                      const dropKeyBase = `${day}::${slot.id}`
                      // co-docência: vários professores no mesmo componente viram
                      // UM bloco, com os professores em etiquetas lado a lado
                      const sameComponent =
                        entries.length > 1 && entries.every((e) => e.componentId === entries[0].componentId)
                      const colorOf = (entry: ScheduleEntry, level: 'conflict' | 'labor' | null) =>
                        level === 'conflict' ? '#dc2626' : level === 'labor' ? '#d97706' : entryDisplay(entry).color
                      const dragProps = (entry: ScheduleEntry, dropKey: string) => ({
                        draggable: !editLocked,
                        onDragStart: () => setDraggingId(entry.id),
                        onDragEnd: () => {
                          setDraggingId(null)
                          setDragOverKey(null)
                        },
                        onDragOver: (e: React.DragEvent) => {
                          e.preventDefault()
                          setDragOverKey(dropKey)
                        },
                        onDragLeave: () => setDragOverKey((k) => (k === dropKey ? null : k)),
                        onDrop: (e: React.DragEvent) => {
                          e.preventDefault()
                          handleDrop(day, slot.id, entry)
                        },
                        onClick: () => setTarget({ day, timeSlotId: slot.id, week: entry.week, existing: entry }),
                      })
                      const alertClass = (level: 'conflict' | 'labor' | null) =>
                        level === 'conflict'
                          ? 'border-red-400 bg-red-50'
                          : level === 'labor'
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-transparent'
                      return (
                        <td key={day} className="p-[3px] align-top">
                          <div className="group/cell relative flex w-full flex-col gap-0.5 rounded-lg print:min-h-[3rem]">
                            {sameComponent ? (
                              (() => {
                                const first = entries[0]
                                const comp = entryDisplay(first)
                                const levels = entries.map((e) => alertLevelFor(e.id))
                                const level = levels.includes('conflict')
                                  ? 'conflict'
                                  : levels.includes('labor')
                                    ? 'labor'
                                    : null
                                return (
                                  <div
                                    className={`flex min-h-[56px] w-full flex-col justify-center rounded-lg border border-l-4 px-2 py-1 text-left ${alertClass(level)}`}
                                    style={
                                      !level
                                        ? { backgroundColor: `${comp.color}14`, borderLeftColor: comp.color }
                                        : undefined
                                    }
                                  >
                                    <span className="truncate text-xs font-semibold" style={{ color: colorOf(first, level) }}>
                                      {comp.name}
                                    </span>
                                    <span className="mt-0.5 flex flex-wrap gap-1">
                                      {entries.map((entry) => {
                                        const t = data.teachers.find((x) => x.id === entry.teacherId)?.name ?? '?'
                                        return (
                                          <button
                                            key={entry.id}
                                            type="button"
                                            title={`${comp.name} · ${t}`}
                                            {...dragProps(entry, `${dropKeyBase}::${entry.id}`)}
                                            className="max-w-full cursor-grab truncate rounded-full border border-slate-300 bg-white px-1.5 text-[10px] text-slate-600 hover:border-brand-400"
                                          >
                                            {t}
                                          </button>
                                        )
                                      })}
                                    </span>
                                  </div>
                                )
                              })()
                            ) : (
                              entries.map((entry) => {
                                const level = alertLevelFor(entry.id)
                                const comp = entryDisplay(entry)
                                const dropKey = `${dropKeyBase}::${entry.id}`
                                return (
                                  <button
                                    key={entry.id}
                                    {...dragProps(entry, dropKey)}
                                    title={
                                      level === 'labor'
                                        ? laborAlertReason(entry.id)
                                        : `${comp.name} · ${entryLabel(entry) ?? ''}${entry.week !== 'AMBAS' ? ` · Semana ${entry.week}` : ''}`
                                    }
                                    className={`flex min-h-[40px] w-full cursor-grab flex-col justify-center rounded-lg border border-l-4 px-2 py-1 text-left transition-colors hover:opacity-90 active:cursor-grabbing ${alertClass(level)} ${
                                      dragOverKey === dropKey ? 'ring-2 ring-inset ring-brand-500' : ''
                                    }`}
                                    style={
                                      !level ? { backgroundColor: `${comp.color}14`, borderLeftColor: comp.color } : undefined
                                    }
                                  >
                                    <span className="flex items-baseline gap-1">
                                      <span className="truncate text-xs font-semibold" style={{ color: colorOf(entry, level) }}>
                                        {comp.name}
                                      </span>
                                      {entry.week !== 'AMBAS' && (
                                        <span className="shrink-0 rounded-full bg-brand-600 px-1.5 text-[9px] font-medium text-white">
                                          {entry.week}
                                        </span>
                                      )}
                                    </span>
                                    <span className="truncate text-[10px] text-slate-500">{entryLabel(entry)}</span>
                                  </button>
                                )
                              })
                            )}
                            <button
                              type="button"
                              title="Adicionar outro professor a este horário"
                              onDragOver={(e) => {
                                if (!draggingId) return
                                e.preventDefault()
                                setDragOverKey(dropKeyBase)
                              }}
                              onDragLeave={() => setDragOverKey((k) => (k === dropKeyBase ? null : k))}
                              onDrop={(e) => {
                                e.preventDefault()
                                handleDrop(day, slot.id, null)
                              }}
                              onClick={() => setTarget({ day, timeSlotId: slot.id, week, existing: null })}
                              className={`group flex items-center justify-center border border-dashed text-slate-300 hover:border-brand-300 hover:bg-brand-50/50 ${
                                entries.length === 0
                                  ? 'h-10 w-full rounded-lg border-slate-200'
                                  : 'absolute right-1 top-1 h-5 w-5 rounded-full border-slate-300 bg-white opacity-0 group-hover/cell:opacity-100 print:hidden'
                              } ${dragOverKey === dropKeyBase ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                            >
                              <Plus
                                size={entries.length === 0 ? 14 : 11}
                                className={entries.length === 0 ? 'opacity-0 group-hover:opacity-100 print:hidden' : ''}
                              />
                            </button>
                          </div>
                        </td>
                      )
                    }

                    if (isSplit) {
                      const entryA = entries.find((e) => e.week === 'A')!
                      const entryB = entries.find((e) => e.week === 'B')!
                      return (
                        <td key={day} className="p-[3px] align-top">
                          <div className="flex h-[60px] w-full flex-col gap-0.5 overflow-hidden rounded-lg print:h-auto print:min-h-[3rem]">
                            {[entryA, entryB].map((entry) => {
                              const alertLevel = alertLevelFor(entry.id)
                              const component = entryDisplay(entry)
                              const dropKey = `${day}::${slot.id}::${entry.week}`
                              const who = entryLabel(entry) ?? ''
                              return (
                                <button
                                  key={entry.id}
                                  draggable={!editLocked}
                                  title={
                                    alertLevel === 'labor'
                                      ? laborAlertReason(entry.id)
                                      : `Semana ${entry.week} · ${component.name}${who ? ` · ${who}` : ''}`
                                  }
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
                                  className={`flex min-h-0 flex-1 w-full cursor-grab items-center gap-1.5 overflow-hidden rounded-lg border border-l-4 px-2 text-left transition-colors hover:opacity-90 active:cursor-grabbing ${
                                    alertLevel === 'conflict'
                                      ? 'border-red-400 bg-red-50'
                                      : alertLevel === 'labor'
                                        ? 'border-amber-400 bg-amber-50'
                                        : 'border-transparent'
                                  } ${dragOverKey === dropKey ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                                  style={
                                    !alertLevel
                                      ? { backgroundColor: `${component.color}14`, borderLeftColor: component.color }
                                      : undefined
                                  }
                                >
                                  <span className="shrink-0 rounded-full bg-brand-600 px-1.5 text-[9px] font-medium text-white">
                                    {entry.week}
                                  </span>
                                  <span className="min-w-0 truncate text-[10px] leading-tight">
                                    <span
                                      className="font-semibold"
                                      style={{
                                        color:
                                          alertLevel === 'conflict'
                                            ? '#dc2626'
                                            : alertLevel === 'labor'
                                              ? '#d97706'
                                              : component.color,
                                      }}
                                    >
                                      {component.name}
                                    </span>
                                    {who && <span className="text-slate-500"> · {who}</span>}
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
                          <td key={day} className="p-[3px] align-top">
                            <div className="flex h-[60px] w-full flex-col gap-0.5 overflow-hidden rounded-lg print:h-auto print:min-h-[3rem]">
                              {(['A', 'B'] as const).map((w) => {
                                const half = halfFor(w)
                                const dropKey = `${day}::${slot.id}::${w}`
                                if (half.kind === 'planning') {
                                  const pe = half.e
                                  const alertLevel = alertLevelFor(pe.id)
                                  const component = entryDisplay(pe)
                                  return (
                                    <button
                                      key={w}
                                      draggable={!editLocked}
                                      title={alertLevel === 'labor' ? laborAlertReason(pe.id) : undefined}
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
                                      className={`flex min-h-0 flex-1 w-full cursor-grab items-center gap-1 overflow-hidden rounded-lg px-2 text-left transition-colors hover:opacity-90 active:cursor-grabbing ${
                                        alertLevel === 'conflict'
                                          ? 'border-red-400 bg-red-50'
                                          : alertLevel === 'labor'
                                            ? 'border-amber-400 bg-amber-50'
                                            : ''
                                      } ${dragOverKey === dropKey ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                                      style={
                                        !alertLevel
                                          ? { backgroundColor: `${component?.color}1a` }
                                          : undefined
                                      }
                                    >
                                      <span className="w-fit shrink-0 rounded bg-slate-700 px-1 text-[9px] font-semibold text-white">
                                        {pe.week === 'AMBAS' ? 'Amb' : pe.week}
                                      </span>
                                      <span
                                        className="truncate text-[11px] font-semibold"
                                        style={{
                                          color:
                                            alertLevel === 'conflict'
                                              ? '#dc2626'
                                              : alertLevel === 'labor'
                                                ? '#d97706'
                                                : component?.color,
                                        }}
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
                                      className="flex min-h-0 flex-1 w-full items-center gap-1 overflow-hidden rounded-lg bg-slate-50 px-2"
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
                                    className={`group flex min-h-0 flex-1 w-full flex-col justify-center rounded-lg border border-dashed border-slate-200 px-2 text-left hover:bg-brand-50/50 ${
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

                    const alertLevel = entry ? alertLevelFor(entry.id) : null
                    const component = entry ? entryDisplay(entry) : undefined
                    const label = entry ? entryLabel(entry) : undefined
                    const dropKey = `${day}::${slot.id}`
                    const regenciaRef = entry ? [] : findRegenciaRef(day, slot.id)
                    const isGap = !entry && regenciaRef.length === 0 && isGapCell(day, slot.id)

                    return (
                      <td key={day} className="p-[3px] align-top">
                        <button
                          draggable={!editLocked && !!entry}
                          title={
                            entry && alertLevel === 'labor'
                              ? laborAlertReason(entry.id)
                              : entry
                                ? `${component?.name} · ${label ?? ''}${entry.week !== 'AMBAS' ? ` · Semana ${entry.week}` : ''}`
                                : isGap
                                ? 'Horário vago entre dois compromissos deste professor no mesmo turno (limite do sindicato)'
                                : undefined
                          }
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
                          className={`group flex min-h-[40px] w-full flex-col justify-center rounded-lg border px-2 py-1 text-left transition-colors print:h-auto print:min-h-[3rem] ${entry && !alertLevel ? 'border-l-4' : ''} ${
                            entry ? 'cursor-grab active:cursor-grabbing' : ''
                          } ${
                            entry
                              ? alertLevel === 'conflict'
                                ? 'border-red-400 bg-red-50 hover:bg-red-100'
                                : alertLevel === 'labor'
                                  ? 'border-amber-400 bg-amber-50 hover:bg-amber-100'
                                  : 'border-transparent hover:opacity-90'
                              : isGap
                                ? 'border-dashed border-amber-400 bg-amber-50 hover:bg-amber-100'
                                : regenciaRef.length > 0
                                  ? 'border-dashed border-slate-300 bg-slate-50 hover:border-brand-300'
                                  : 'border-dashed border-slate-200 hover:border-brand-300 hover:bg-brand-50/50'
                          } ${dragOverKey === dropKey ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                          style={
                            entry && !alertLevel
                              ? { backgroundColor: `${component?.color}14`, borderLeftColor: component?.color }
                              : undefined
                          }
                        >
                          {entry ? (
                            <>
                              <span
                                className="truncate text-xs font-semibold"
                                style={{
                                  color:
                                    alertLevel === 'conflict'
                                      ? '#dc2626'
                                      : alertLevel === 'labor'
                                        ? '#d97706'
                                        : component?.color,
                                }}
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
                          ) : isGap ? (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600">
                              <AlertTriangle size={12} /> Vago
                            </span>
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
                {BREAK_AFTER[slot.id] && (
                  <tr className="print:hidden">
                    <td
                      colSpan={WEEKDAYS.length + 1}
                      className="bg-slate-100 px-3 py-0.5 text-center text-[10px] font-medium uppercase tracking-widest text-slate-400"
                    >
                      {BREAK_AFTER[slot.id]}
                    </td>
                  </tr>
                )}
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
