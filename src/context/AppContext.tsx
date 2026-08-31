import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  findTeacherConflicts,
  findDailyOverloadEntries,
  findLunchBreakViolations,
} from '../utils/conflicts'
import type {
  AppData,
  ClassGroup,
  CurricularComponent,
  ScheduleEntry,
  Teacher,
} from '../types'

interface AppContextValue {
  data: AppData
  conflicts: Set<string>
  /** mais de 8 tempos (regência + planejamento) no mesmo dia para o professor */
  dailyOverloadEntries: Set<string>
  /** professor ocupado ao mesmo tempo no último tempo da manhã e no primeiro da tarde (sem almoço) */
  lunchBreakViolations: Set<string>
  activeSchoolId: string
  setActiveSchoolId: (id: string) => void
  accessibleSchoolIds: string[]
  loading: boolean
  lastSavedAt: number
  saveNow: () => void

  addTeacher: (t: Omit<Teacher, 'id' | 'schoolId'>) => void
  updateTeacher: (id: string, t: Omit<Teacher, 'id' | 'schoolId'>) => void
  deleteTeacher: (id: string) => void

  addClass: (c: Omit<ClassGroup, 'id' | 'schoolId'>) => void
  updateClass: (id: string, c: Omit<ClassGroup, 'id' | 'schoolId'>) => void
  deleteClass: (id: string) => void

  addComponent: (c: Omit<CurricularComponent, 'id'>, teacherIds: string[]) => void
  updateComponent: (id: string, c: Omit<CurricularComponent, 'id'>, teacherIds: string[]) => void
  deleteComponent: (id: string) => void

  upsertScheduleEntry: (
    entry: Omit<ScheduleEntry, 'id' | 'schoolId'> & { id?: string },
  ) => Promise<void>
  removeScheduleEntry: (id: string) => void

  replaceAllData: (data: AppData) => void

  /** desfazer a última ação (professor/turma/componente/aula) */
  undo: () => void
  canUndo: boolean
  undoLabel: string | null
  /** agrupa várias mutações (ex: troca de 2 aulas ao arrastar) em 1 único "desfazer" */
  beginBatch: () => void
  commitBatch: (label: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const emptyData: AppData = { schools: [], teachers: [], classes: [], components: [], schedule: [] }

// ---------------------------------------------------------------------------
// mapeamento snake_case (banco) <-> camelCase (app)
// ---------------------------------------------------------------------------
type DbComponent = {
  id: string
  name: string
  category: string
  color: string
  weekly_hours: number
  planning_hours: number
}
type DbTeacher = {
  id: string
  school_id: string
  name: string
  email: string | null
  phone: string | null
  component_ids: string[]
  contracted_hours_2026: number
  is_orientador: boolean
  orientador_target_hours: number
}
type DbClass = { id: string; school_id: string; name: string; shift: string; year: string | null }
type DbEntry = {
  id: string
  school_id: string
  type: string
  week: string
  day: string
  time_slot_id: string
  class_id: string | null
  component_id: string | null
  teacher_id: string
}

const compFromDb = (c: DbComponent): CurricularComponent => ({
  id: c.id,
  name: c.name,
  category: c.category,
  color: c.color,
  weeklyHours: c.weekly_hours,
  planningHours: c.planning_hours,
})
const compToDb = (c: Omit<CurricularComponent, 'id'>) => ({
  name: c.name,
  category: c.category,
  color: c.color,
  weekly_hours: c.weeklyHours,
  planning_hours: c.planningHours,
})

const teacherFromDb = (t: DbTeacher): Teacher => ({
  id: t.id,
  schoolId: t.school_id,
  name: t.name,
  email: t.email ?? undefined,
  phone: t.phone ?? undefined,
  componentIds: t.component_ids ?? [],
  contractedHours2026: t.contracted_hours_2026,
  isOrientador: t.is_orientador,
  orientadorTargetHours: t.orientador_target_hours,
})
const teacherToDb = (t: Omit<Teacher, 'id' | 'schoolId'>, schoolId: string) => ({
  school_id: schoolId,
  name: t.name,
  email: t.email || null,
  phone: t.phone || null,
  component_ids: t.componentIds,
  contracted_hours_2026: t.contractedHours2026,
  is_orientador: t.isOrientador,
  orientador_target_hours: t.orientadorTargetHours,
})

const classFromDb = (c: DbClass): ClassGroup => ({
  id: c.id,
  schoolId: c.school_id,
  name: c.name,
  shift: c.shift as ClassGroup['shift'],
  year: c.year ?? undefined,
})
const classToDb = (c: Omit<ClassGroup, 'id' | 'schoolId'>, schoolId: string) => ({
  school_id: schoolId,
  name: c.name,
  shift: c.shift,
  year: c.year || null,
})

const entryFromDb = (e: DbEntry): ScheduleEntry => ({
  id: e.id,
  schoolId: e.school_id,
  type: e.type as ScheduleEntry['type'],
  week: e.week as ScheduleEntry['week'],
  day: e.day as ScheduleEntry['day'],
  timeSlotId: e.time_slot_id,
  classId: e.class_id ?? undefined,
  componentId: e.component_id ?? undefined,
  teacherId: e.teacher_id,
})
const entryToDb = (e: Omit<ScheduleEntry, 'id' | 'schoolId'>, schoolId: string) => ({
  school_id: schoolId,
  type: e.type,
  week: e.week,
  day: e.day,
  time_slot_id: e.timeSlotId,
  class_id: e.classId ?? null,
  component_id: e.componentId ?? null,
  teacher_id: e.teacherId,
})

// O Supabase (PostgREST) limita a 1000 linhas por requisição por padrão.
// Com várias unidades, schedule_entries já passa disso — pagina até esgotar.
const PAGE_SIZE = 1000
async function fetchAllRows<T>(table: string): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`Erro ao buscar ${table}:`, error)
      break
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

// ---------------------------------------------------------------------------
// desfazer (undo): cada mutação bem-sucedida empilha um "passo inverso" que
// refaz a chamada oposta direto no Supabase (sem passar pelos mutators
// públicos, para não empilhar undo de um undo). Fica só na memória da aba —
// não é persistido, não é o mesmo que o backup/ponto de retorno completo.
// ---------------------------------------------------------------------------
type UndoStep = () => Promise<void>
interface UndoEntry {
  label: string
  steps: UndoStep[]
}
const MAX_UNDO = 30

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<AppData>(emptyData)
  const [accessibleSchoolIds, setAccessibleSchoolIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSavedAt, setLastSavedAt] = useState(() => Date.now())
  const [activeSchoolId, setActiveSchoolIdRaw] = useLocalStorage<string>(
    'grades-active-school',
    '',
  )
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const batchRef = useRef<UndoStep[] | null>(null)

  const refetchAll = useCallback(async () => {
    const [schoolsRes, componentsRes, teachersRows, classesRows, scheduleRows, accessRes] =
      await Promise.all([
        supabase.from('schools').select('*'),
        supabase.from('components').select('*'),
        fetchAllRows<DbTeacher>('teachers'),
        fetchAllRows<DbClass>('classes'),
        fetchAllRows<DbEntry>('schedule_entries'),
        supabase.from('school_access').select('school_id'),
      ])

    const errors = [schoolsRes.error, componentsRes.error, accessRes.error].filter(Boolean)
    if (errors.length > 0) {
      console.error('Erro ao buscar dados do Supabase:', errors)
    }

    setData({
      schools: (schoolsRes.data ?? []).map((s) => ({ id: s.id, name: s.name })),
      components: (componentsRes.data ?? []).map(compFromDb),
      teachers: teachersRows.map(teacherFromDb),
      classes: classesRows.map(classFromDb),
      schedule: scheduleRows.map(entryFromDb),
    })
    setAccessibleSchoolIds((accessRes.data ?? []).map((a) => a.school_id))
    setLastSavedAt(Date.now())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) {
      setData(emptyData)
      setAccessibleSchoolIds([])
      setLoading(false)
      return
    }
    setLoading(true)
    refetchAll()
  }, [user, refetchAll])

  // registra o passo inverso de uma mutação bem-sucedida; se estiver dentro
  // de um beginBatch()/commitBatch(), acumula no lote em vez de empilhar
  // como uma ação isolada
  const finishMutation = useCallback(
    (label: string, step: UndoStep) => {
      if (batchRef.current) {
        batchRef.current.push(step)
        return
      }
      setUndoStack((prev) => [...prev.slice(-(MAX_UNDO - 1)), { label, steps: [step] }])
      refetchAll()
    },
    [refetchAll],
  )

  const beginBatch = useCallback(() => {
    batchRef.current = []
  }, [])

  const commitBatch = useCallback(
    (label: string) => {
      const steps = batchRef.current ?? []
      batchRef.current = null
      if (steps.length > 0) {
        setUndoStack((prev) => [...prev.slice(-(MAX_UNDO - 1)), { label, steps }])
      }
      refetchAll()
    },
    [refetchAll],
  )

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      const entry = prev[prev.length - 1]
      if (!entry) return prev
      ;(async () => {
        for (const step of [...entry.steps].reverse()) {
          try {
            await step()
          } catch (err) {
            console.error('Erro ao desfazer:', err)
          }
        }
        refetchAll()
      })()
      return prev.slice(0, -1)
    })
  }, [refetchAll])

  // garante que a unidade ativa é sempre uma que o usuário pode acessar
  useEffect(() => {
    if (loading) return
    if (accessibleSchoolIds.length === 0) return
    if (!accessibleSchoolIds.includes(activeSchoolId)) {
      setActiveSchoolIdRaw(accessibleSchoolIds[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, accessibleSchoolIds])

  const schoolSchedule = useMemo(
    () => data.schedule.filter((e) => e.schoolId === activeSchoolId),
    [data.schedule, activeSchoolId],
  )
  const conflicts = useMemo(() => findTeacherConflicts(schoolSchedule), [schoolSchedule])
  const dailyOverloadEntries = useMemo(() => findDailyOverloadEntries(schoolSchedule), [schoolSchedule])
  const lunchBreakViolations = useMemo(() => findLunchBreakViolations(schoolSchedule), [schoolSchedule])

  const value: AppContextValue = {
    data,
    conflicts,
    dailyOverloadEntries,
    lunchBreakViolations,
    activeSchoolId,
    setActiveSchoolId: setActiveSchoolIdRaw,
    accessibleSchoolIds,
    loading,
    lastSavedAt,
    saveNow: () => {
      refetchAll()
    },

    addTeacher: (t) => {
      supabase
        .from('teachers')
        .insert(teacherToDb(t, activeSchoolId))
        .select()
        .single()
        .then(({ data: inserted, error }) => {
          if (error || !inserted) {
            console.error(error)
            refetchAll()
            return
          }
          finishMutation(`Adicionar professor "${t.name}"`, async () => {
            await supabase.from('teachers').delete().eq('id', inserted.id)
          })
        })
    },
    updateTeacher: (id, t) => {
      const current = data.teachers.find((x) => x.id === id)
      if (!current) return
      supabase
        .from('teachers')
        .update(teacherToDb(t, current.schoolId))
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error(error)
            refetchAll()
            return
          }
          finishMutation(`Editar professor "${current.name}"`, async () => {
            await supabase.from('teachers').update(teacherToDb(current, current.schoolId)).eq('id', id)
          })
        })
    },
    deleteTeacher: (id) => {
      const current = data.teachers.find((x) => x.id === id)
      supabase
        .from('teachers')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error(error)
            refetchAll()
            return
          }
          if (!current) {
            refetchAll()
            return
          }
          finishMutation(`Excluir professor "${current.name}"`, async () => {
            await supabase.from('teachers').insert({ id: current.id, ...teacherToDb(current, current.schoolId) })
          })
        })
    },

    addClass: (c) => {
      supabase
        .from('classes')
        .insert(classToDb(c, activeSchoolId))
        .select()
        .single()
        .then(({ data: inserted, error }) => {
          if (error || !inserted) {
            console.error(error)
            refetchAll()
            return
          }
          finishMutation(`Adicionar turma "${c.name}"`, async () => {
            await supabase.from('classes').delete().eq('id', inserted.id)
          })
        })
    },
    updateClass: (id, c) => {
      const current = data.classes.find((x) => x.id === id)
      if (!current) return
      supabase
        .from('classes')
        .update(classToDb(c, current.schoolId))
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error(error)
            refetchAll()
            return
          }
          finishMutation(`Editar turma "${current.name}"`, async () => {
            await supabase.from('classes').update(classToDb(current, current.schoolId)).eq('id', id)
          })
        })
    },
    deleteClass: (id) => {
      const current = data.classes.find((x) => x.id === id)
      supabase
        .from('classes')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error(error)
            refetchAll()
            return
          }
          if (!current) {
            refetchAll()
            return
          }
          finishMutation(`Excluir turma "${current.name}"`, async () => {
            await supabase.from('classes').insert({ id: current.id, ...classToDb(current, current.schoolId) })
          })
        })
    },

    addComponent: async (c, teacherIds) => {
      const { data: inserted, error } = await supabase
        .from('components')
        .insert(compToDb(c))
        .select()
        .single()
      if (error || !inserted) {
        console.error(error)
        refetchAll()
        return
      }
      const affected = teacherIds
        .map((tid) => data.teachers.find((x) => x.id === tid))
        .filter((t): t is Teacher => Boolean(t))
      await Promise.all(
        affected.map((t) =>
          supabase.from('teachers').update({ component_ids: [...t.componentIds, inserted.id] }).eq('id', t.id),
        ),
      )
      finishMutation(`Adicionar componente "${c.name}"`, async () => {
        await Promise.all(
          affected.map((t) => supabase.from('teachers').update({ component_ids: t.componentIds }).eq('id', t.id)),
        )
        await supabase.from('components').delete().eq('id', inserted.id)
      })
    },
    updateComponent: async (id, c, teacherIds) => {
      const prevComponent = data.components.find((x) => x.id === id)
      const teachersBefore = data.teachers.map((t) => ({ id: t.id, componentIds: t.componentIds }))
      const { error } = await supabase.from('components').update(compToDb(c)).eq('id', id)
      if (error) console.error(error)
      await Promise.all(
        data.teachers.map((t) => {
          const shouldHave = teacherIds.includes(t.id)
          const has = t.componentIds.includes(id)
          if (shouldHave === has) return null
          const nextIds = shouldHave
            ? [...t.componentIds, id]
            : t.componentIds.filter((cid) => cid !== id)
          return supabase.from('teachers').update({ component_ids: nextIds }).eq('id', t.id)
        }),
      )
      if (!prevComponent) {
        refetchAll()
        return
      }
      finishMutation(`Editar componente "${prevComponent.name}"`, async () => {
        await supabase.from('components').update(compToDb(prevComponent)).eq('id', id)
        await Promise.all(
          teachersBefore.map((t) =>
            supabase.from('teachers').update({ component_ids: t.componentIds }).eq('id', t.id),
          ),
        )
      })
    },
    deleteComponent: async (id) => {
      const prevComponent = data.components.find((x) => x.id === id)
      const affected = data.teachers.filter((t) => t.componentIds.includes(id))
      await Promise.all(
        affected.map((t) =>
          supabase
            .from('teachers')
            .update({ component_ids: t.componentIds.filter((cid) => cid !== id) })
            .eq('id', t.id),
        ),
      )
      const { error } = await supabase.from('components').delete().eq('id', id)
      if (error) console.error(error)
      if (!prevComponent) {
        refetchAll()
        return
      }
      finishMutation(`Excluir componente "${prevComponent.name}"`, async () => {
        await supabase.from('components').insert({ id: prevComponent.id, ...compToDb(prevComponent) })
        await Promise.all(
          affected.map((t) => supabase.from('teachers').update({ component_ids: t.componentIds }).eq('id', t.id)),
        )
      })
    },

    upsertScheduleEntry: async (entry) => {
      if (entry.id) {
        const id = entry.id
        const current = data.schedule.find((e) => e.id === id)
        if (!current) return
        const { error } = await supabase
          .from('schedule_entries')
          .update(entryToDb(entry, current.schoolId))
          .eq('id', id)
        if (error) {
          console.error(error)
          refetchAll()
          return
        }
        finishMutation('Editar aula', async () => {
          await supabase.from('schedule_entries').update(entryToDb(current, current.schoolId)).eq('id', id)
        })
      } else {
        const { data: inserted, error } = await supabase
          .from('schedule_entries')
          .insert(entryToDb(entry, activeSchoolId))
          .select()
          .single()
        if (error || !inserted) {
          console.error(error)
          refetchAll()
          return
        }
        finishMutation('Adicionar aula', async () => {
          await supabase.from('schedule_entries').delete().eq('id', inserted.id)
        })
      }
    },
    removeScheduleEntry: (id) => {
      const current = data.schedule.find((e) => e.id === id)
      supabase
        .from('schedule_entries')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            console.error(error)
            refetchAll()
            return
          }
          if (!current) {
            refetchAll()
            return
          }
          finishMutation('Remover aula', async () => {
            await supabase.from('schedule_entries').insert({ id: current.id, ...entryToDb(current, current.schoolId) })
          })
        })
    },

    replaceAllData: async (newData) => {
      // upsert componentes (globais, por id)
      if (newData.components.length > 0) {
        await supabase
          .from('components')
          .upsert(newData.components.map((c) => ({ id: c.id, ...compToDb(c) })))
      }

      const schoolIdsInImport = Array.from(
        new Set([
          ...newData.teachers.map((t) => t.schoolId),
          ...newData.classes.map((c) => c.schoolId),
          ...newData.schedule.map((e) => e.schoolId),
        ]),
      ).filter((id) => accessibleSchoolIds.includes(id))

      for (const schoolId of schoolIdsInImport) {
        await supabase.from('schedule_entries').delete().eq('school_id', schoolId)
        await supabase.from('teachers').delete().eq('school_id', schoolId)
        await supabase.from('classes').delete().eq('school_id', schoolId)

        const teachers = newData.teachers.filter((t) => t.schoolId === schoolId)
        const classes = newData.classes.filter((c) => c.schoolId === schoolId)
        const schedule = newData.schedule.filter((e) => e.schoolId === schoolId)

        if (teachers.length > 0) {
          await supabase
            .from('teachers')
            .insert(teachers.map((t) => ({ id: t.id, ...teacherToDb(t, schoolId) })))
        }
        if (classes.length > 0) {
          await supabase
            .from('classes')
            .insert(classes.map((c) => ({ id: c.id, ...classToDb(c, schoolId) })))
        }
        if (schedule.length > 0) {
          await supabase
            .from('schedule_entries')
            .insert(schedule.map((e) => ({ id: e.id, ...entryToDb(e, schoolId) })))
        }
      }

      setUndoStack([])
      refetchAll()
    },

    undo,
    canUndo: undoStack.length > 0,
    undoLabel: undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null,
    beginBatch,
    commitBatch,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider')
  return ctx
}
