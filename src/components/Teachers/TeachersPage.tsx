import { useState } from 'react'
import { Compass, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { Teacher } from '../../types'
import { TeacherModal } from './TeacherModal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { teacherChargeReport } from '../../utils/teacherReport'
import { fmtHours } from '../../utils/format'

export function TeachersPage() {
  const { data, activeSchoolId, deleteTeacher } = useApp()
  const [editing, setEditing] = useState<Teacher | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Teacher | null>(null)

  const schoolName = data.schools.find((s) => s.id === activeSchoolId)?.name ?? ''
  const teachers = data.teachers.filter((t) => t.schoolId === activeSchoolId)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Professores</h1>
          <p className="text-sm text-slate-500">
            {teachers.length} cadastrados · {schoolName}
          </p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Novo Professor
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teachers.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <UserRound size={18} />
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-medium text-slate-800">
                    {t.name}
                    {t.isOrientador && (
                      <span
                        title="Professor Orientador"
                        className="flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"
                      >
                        <Compass size={10} /> Orientador
                      </span>
                    )}
                  </p>
                  {t.email && <p className="text-xs text-slate-400">{t.email}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing(t)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeleting(t)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.componentIds.map((cid) => {
                const comp = data.components.find((c) => c.id === cid)
                if (!comp) return null
                return (
                  <span
                    key={cid}
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: comp.color }}
                  >
                    {comp.name}
                  </span>
                )
              })}
              {t.componentIds.length === 0 && (
                <span className="text-xs text-slate-400">Sem componentes vinculados</span>
              )}
            </div>

            {(() => {
              const { regencia, planejamento, planejamentoLabel, saldo } = teacherChargeReport(
                t,
                data.schedule,
              )
              return (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{fmtHours(regencia)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        Regência
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {fmtHours(planejamento)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        {planejamentoLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {t.contractedHours2026}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        Contratado 26
                      </p>
                    </div>
                  </div>
                  <div
                    className={`mt-2 rounded-lg px-2 py-1.5 text-center text-xs font-medium ${
                      saldo > 0
                        ? 'bg-red-50 text-red-600'
                        : saldo < 0
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {saldo > 0
                      ? `Precisa ampliar +${fmtHours(saldo)}h para cobrir a grade de 2027`
                      : saldo < 0
                        ? `Contrato ${fmtHours(Math.abs(saldo))}h acima da demanda de 2027. Essa CH poderá ser alocada em Planejamento`
                        : 'Carga contratada cobre exatamente a demanda de 2027'}
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      {teachers.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          Nenhum professor cadastrado. Clique em "Novo Professor" para começar.
        </div>
      )}

      {editing !== undefined && (
        <TeacherModal teacher={editing} onClose={() => setEditing(undefined)} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Excluir professor"
          message={`Tem certeza que deseja excluir "${deleting.name}"? Isso removerá também suas alocações na grade.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteTeacher(deleting.id)
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
