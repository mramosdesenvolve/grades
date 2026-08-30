import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { CurricularComponent } from '../../types'
import { ComponentModal } from './ComponentModal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { entryWeight } from '../../utils/conflicts'
import { fmtHours } from '../../utils/format'

export function ComponentsPage() {
  const { data, deleteComponent } = useApp()
  const [editing, setEditing] = useState<CurricularComponent | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<CurricularComponent | null>(null)

  const categories = Array.from(new Set(data.components.map((c) => c.category)))

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Componentes Curriculares</h1>
          <p className="text-sm text-slate-500">{data.components.length} cadastrados</p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Novo Componente
        </button>
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {category}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.components
                .filter((c) => c.category === category)
                .map((c) => {
                  const allocated = data.schedule
                    .filter((e) => e.type === 'aula' && e.componentId === c.id)
                    .reduce((sum, e) => sum + entryWeight(e), 0)
                  const planningAllocated = data.schedule
                    .filter((e) => e.type === 'planejamento' && e.componentId === c.id)
                    .reduce((sum, e) => sum + entryWeight(e), 0)
                  const teacherCount = data.teachers.filter((t) =>
                    t.componentIds.includes(c.id),
                  ).length
                  const balanced = allocated === c.weeklyHours
                  const over = allocated > c.weeklyHours
                  const planBalanced = planningAllocated === c.planningHours
                  const planOver = planningAllocated > c.planningHours
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          <p className="font-medium text-slate-800">{c.name}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditing(c)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleting(c)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            over
                              ? 'bg-red-50 text-red-600'
                              : balanced
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {fmtHours(allocated)}/{c.weeklyHours} aulas
                        </span>
                        {c.planningHours > 0 && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              planOver
                                ? 'bg-red-50 text-red-600'
                                : planBalanced
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-amber-50 text-amber-600'
                            }`}
                          >
                            {fmtHours(planningAllocated)}/{c.planningHours} planejamento
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 text-xs text-slate-400">
                        {teacherCount} professor(es)
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>

      {data.components.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          Nenhum componente cadastrado.
        </div>
      )}

      {editing !== undefined && (
        <ComponentModal component={editing} onClose={() => setEditing(undefined)} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Excluir componente"
          message={`Tem certeza que deseja excluir "${deleting.name}"? Isso removerá também suas alocações na grade.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteComponent(deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
