import type { AppData, ComponentCategory, CurricularComponent, School, TimeSlot } from '../types'
import { colorForComponent } from './bnccAreas'

export const SCHOOLS: School[] = [
  { id: 'capsula', name: 'Cápsula' },
  { id: 'barra-da-tijuca', name: 'Barra da Tijuca' },
  { id: 'niteroi', name: 'Niterói' },
  { id: 'politecnico', name: 'Politécnico' },
]

export const TIME_SLOTS: TimeSlot[] = [
  { id: 'm1', shift: 'Matutino', order: 1, label: '07h15' },
  { id: 'm2', shift: 'Matutino', order: 2, label: '08h05' },
  { id: 'm3', shift: 'Matutino', order: 3, label: '08h55' },
  { id: 'm4', shift: 'Matutino', order: 4, label: '10h15' },
  { id: 'm5', shift: 'Matutino', order: 5, label: '11h05' },
  { id: 'm6', shift: 'Matutino', order: 6, label: '11h55' },
  { id: 'v1', shift: 'Vespertino', order: 1, label: '13h00' },
  { id: 'v2', shift: 'Vespertino', order: 2, label: '13h50' },
  { id: 'v3', shift: 'Vespertino', order: 3, label: '14h40' },
  { id: 'v4', shift: 'Vespertino', order: 4, label: '15h50' },
  { id: 'v5', shift: 'Vespertino', order: 5, label: '16h40' },
  { id: 'v6', shift: 'Vespertino', order: 6, label: '17h30' },
]

function makeComponent(
  name: string,
  category: ComponentCategory,
  weeklyHours = 2,
  planningHours = 0,
): CurricularComponent {
  return {
    id: crypto.randomUUID(),
    name,
    category,
    color: colorForComponent(name, category),
    weeklyHours,
    planningHours,
  }
}

export function buildSeedData(): AppData {
  const baseComum = [
    'Artes',
    'Biologia',
    'Educação Física',
    'Filosofia',
    'Física',
    'Geografia',
    'História',
    'Inglês',
    'Português',
    'Química',
    'Sociologia',
  ].map((n) => makeComponent(n, 'Base Comum'))

  const formacaoTecnica = ['Inteligência Artificial', 'Multimídia', 'Administração'].map((n) =>
    makeComponent(n, 'Formação Técnica', 4),
  )

  // "Projeto de Ano Letivo" está sempre associado a uma trilha de Formação
  // Técnica específica (LET-IA, LET-MMD, LET-ADM...), por isso não existe uma
  // versão genérica — cada trilha ganha o seu componente próprio conforme for
  // usada.
  const projetos = ['Projeto de Vida'].map((n) => makeComponent(n, 'Projetos', 1))

  return {
    schools: SCHOOLS,
    teachers: [],
    classes: [],
    components: [...baseComum, ...formacaoTecnica, ...projetos],
    schedule: [],
  }
}
