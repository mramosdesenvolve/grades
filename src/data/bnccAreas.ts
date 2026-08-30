/**
 * Áreas de conhecimento do Novo Ensino Médio (BNCC) + trilhas extra-BNCC
 * (Formação Técnica e Projetos). Cada componente herda a cor da sua área,
 * mantendo a grade visualmente consistente.
 */
export interface BnccArea {
  id: string
  label: string
  color: string
}

export const BNCC_AREAS: BnccArea[] = [
  { id: 'linguagens', label: 'Linguagens e suas Tecnologias', color: '#dc2626' },
  { id: 'matematica', label: 'Matemática e suas Tecnologias', color: '#2563eb' },
  { id: 'natureza', label: 'Ciências da Natureza e suas Tecnologias', color: '#16a34a' },
  { id: 'humanas', label: 'Ciências Humanas e Sociais Aplicadas', color: '#d97706' },
  { id: 'tecnica', label: 'Formação Técnica e Profissional', color: '#7c3aed' },
  { id: 'projetos', label: 'Projetos', color: '#0891b2' },
]

/** Mapeia o nome do componente (Base Comum) para o id de área BNCC. */
const COMPONENT_TO_AREA: Record<string, string> = {
  Português: 'linguagens',
  Inglês: 'linguagens',
  Artes: 'linguagens',
  'Educação Física': 'linguagens',
  Matemática: 'matematica',
  Biologia: 'natureza',
  Física: 'natureza',
  Química: 'natureza',
  História: 'humanas',
  Geografia: 'humanas',
  Filosofia: 'humanas',
  Sociologia: 'humanas',
}

export function areaForComponent(name: string, category: string): BnccArea {
  if (category === 'Formação Técnica') return BNCC_AREAS.find((a) => a.id === 'tecnica')!
  if (category === 'Projetos') return BNCC_AREAS.find((a) => a.id === 'projetos')!
  const areaId = COMPONENT_TO_AREA[name]
  return BNCC_AREAS.find((a) => a.id === areaId) ?? BNCC_AREAS.find((a) => a.id === 'humanas')!
}

export function colorForComponent(name: string, category: string): string {
  return areaForComponent(name, category).color
}
