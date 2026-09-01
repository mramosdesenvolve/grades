import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { WeekType } from '../../types'
import { ComponentGrid } from './ComponentGrid'

/**
 * Visão "Todas as Unidades": mostra, para um componente escolhido, a grade
 * somada de todas as unidades acessíveis — onde cada professor de cada
 * unidade está regendo (aula) ou planejando (planejamento) aquele
 * componente. Somente leitura (trocar professor exige entrar na grade da
 * unidade específica).
 */
export function AllUnitsComponentPage({ entryType }: { entryType: 'aula' | 'planejamento' }) {
  const { data, accessibleSchoolIds } = useApp()
  const [componentId, setComponentId] = useState('')
  const [week, setWeek] = useState<WeekType>('AMBAS')

  const components = useMemo(() => {
    const ids = new Set(
      data.schedule
        .filter(
          (e) => e.type === entryType && e.componentId && accessibleSchoolIds.includes(e.schoolId),
        )
        .map((e) => e.componentId as string),
    )
    return data.components
      .filter((c) => ids.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [data.schedule, data.components, accessibleSchoolIds, entryType])

  useEffect(() => {
    if (components.length > 0 && !components.find((c) => c.id === componentId)) {
      setComponentId(components[0].id)
    }
    if (components.length === 0) setComponentId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components])

  const title = entryType === 'aula' ? 'Regência por Componente' : 'Planejamento por Componente'

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        <p className="text-sm text-slate-500">
          Todas as unidades · onde cada professor está{' '}
          {entryType === 'aula' ? 'regendo' : 'planejando'} este componente
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={componentId}
          onChange={(e) => setComponentId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {components.length === 0 && <option value="">Nenhum componente</option>}
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(['A', 'B', 'AMBAS'] as WeekType[]).map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                week === w ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {w === 'AMBAS' ? 'Ambas' : `Semana ${w}`}
            </button>
          ))}
        </div>
      </div>

      {componentId ? (
        <ComponentGrid componentId={componentId} week={week} entryType={entryType} />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          Nenhum lançamento de {entryType === 'aula' ? 'regência' : 'planejamento'} encontrado.
        </div>
      )}
    </div>
  )
}
