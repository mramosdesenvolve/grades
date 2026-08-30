import { useState } from 'react'
import { LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { ClassGroup } from '../../types'
import { ClassModal } from './ClassModal'
import { ConfirmDialog } from '../common/ConfirmDialog'

export function ClassesPage() {
  const { data, activeSchoolId, deleteClass } = useApp()
  const [editing, setEditing] = useState<ClassGroup | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<ClassGroup | null>(null)

  const schoolName = data.schools.find((s) => s.id === activeSchoolId)?.name ?? ''
  const classes = data.classes.filter((c) => c.schoolId === activeSchoolId)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Turmas</h1>
          <p className="text-sm text-slate-500">
            {classes.length} cadastradas · {schoolName}
          </p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Nova Turma
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <LayoutGrid size={18} />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    {c.shift}
                    {c.year ? ` · ${c.year}` : ''}
                  </p>
                </div>
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
          </div>
        ))}
      </div>

      {classes.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          Nenhuma turma cadastrada. Clique em "Nova Turma" para começar.
        </div>
      )}

      {editing !== undefined && (
        <ClassModal classGroup={editing} onClose={() => setEditing(undefined)} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Excluir turma"
          message={`Tem certeza que deseja excluir "${deleting.name}"? Isso removerá também suas alocações na grade.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteClass(deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
