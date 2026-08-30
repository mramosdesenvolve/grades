export type Shift = 'Matutino' | 'Vespertino'

export type WeekType = 'A' | 'B' | 'AMBAS'

export type Weekday = 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta'

export const WEEKDAYS: Weekday[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']

export interface TimeSlot {
  id: string
  shift: Shift
  order: number
  label: string // ex: 07h15
}

export type ComponentCategory = 'Base Comum' | 'Formação Técnica' | 'Projetos' | string

export interface CurricularComponent {
  id: string
  name: string
  category: ComponentCategory
  color: string // hex color
  weeklyHours: number // carga horária semanal em aula (com a turma)
  planningHours: number // carga horária semanal de planejamento do professor
}

export interface School {
  id: string
  name: string
}

export interface Teacher {
  id: string
  schoolId: string
  name: string
  email?: string
  phone?: string
  componentIds: string[]
  contractedHours2026: number // carga horária semanal já contratada (ano-base 2026), para comparar com a demanda da nova grade
  isOrientador: boolean // Professor Orientador: acumula FTP + LET de 1-2 turmas e tem a carga ampliada até orientadorTargetHours
  orientadorTargetHours: number // carga horária total-alvo (regência + planejamento/orientação) quando isOrientador === true
}

export interface ClassGroup {
  id: string
  schoolId: string
  name: string
  shift: Shift
  year?: string
}

export type EntryType = 'aula' | 'planejamento' | 'orientacao'

export interface ScheduleEntry {
  id: string
  schoolId: string
  type: EntryType
  week: WeekType
  day: Weekday
  timeSlotId: string
  classId?: string // presente apenas quando type === 'aula'
  componentId?: string // ausente quando type === 'orientacao' (não é ligado a um componente)
  teacherId: string
}

export interface AppData {
  schools: School[]
  teachers: Teacher[]
  classes: ClassGroup[]
  components: CurricularComponent[]
  schedule: ScheduleEntry[]
}

export interface ConflictInfo {
  entryId: string
  reason: string
}
