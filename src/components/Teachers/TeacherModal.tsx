import { useState } from 'react'
import { Modal } from '../common/Modal'
import type { Teacher } from '../../types'
import { useApp } from '../../context/AppContext'

export function TeacherModal({
  teacher,
  onClose,
}: {
  teacher: Teacher | null
  onClose: () => void
}) {
  const { data, addTeacher, updateTeacher } = useApp()
  const [name, setName] = useState(teacher?.name ?? '')
  const [email, setEmail] = useState(teacher?.email ?? '')
  const [phone, setPhone] = useState(teacher?.phone ?? '')
  const [componentIds, setComponentIds] = useState<string[]>(teacher?.componentIds ?? [])
  const [contractedHours2026, setContractedHours2026] = useState(
    teacher?.contractedHours2026 ?? 0,
  )
  const [isOrientador, setIsOrientador] = useState(teacher?.isOrientador ?? false)
  const [orientadorTargetHours, setOrientadorTargetHours] = useState(
    teacher?.orientadorTargetHours ?? 40,
  )

  const toggleComponent = (id: string) => {
    setComponentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      componentIds,
      contractedHours2026: Math.max(0, contractedHours2026),
      isOrientador,
      orientadorTargetHours: Math.max(0, orientadorTargetHours),
    }
    if (teacher) updateTeacher(teacher.id, payload)
    else addTeacher(payload)
    onClose()
  }

  return (
    <Modal title={teacher ? 'Editar Professor' : 'Novo Professor'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Nome completo"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="opcional"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="opcional"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Carga já Contratada (2026, aulas/semana)
          </label>
          <input
            type="number"
            min={0}
            value={contractedHours2026}
            onChange={(e) => setContractedHours2026(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            Carga horária semanal atual do contrato. A Regência e o Planejamento previstos para a
            nova grade são calculados automaticamente a partir do que for montado.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isOrientador}
              onChange={(e) => setIsOrientador(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            É Professor Orientador
          </label>
          <p className="mt-1 text-xs text-slate-400">
            Acumula FTP e Projeto de Ano Letivo de uma ou duas turmas; o restante da carga até o
            total-alvo é planejamento/orientação (não precisa ser alocado na grade).
          </p>
          {isOrientador && (
            <div className="mt-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Carga Total-Alvo (h/semana)
              </label>
              <input
                type="number"
                min={0}
                value={orientadorTargetHours}
                onChange={(e) => setOrientadorTargetHours(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Componentes Curriculares
          </label>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {data.components.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleComponent(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  componentIds.includes(c.id)
                    ? 'border-transparent text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                style={componentIds.includes(c.id) ? { backgroundColor: c.color } : undefined}
              >
                {c.name}
              </button>
            ))}
            {data.components.length === 0 && (
              <p className="text-xs text-slate-400">Nenhum componente cadastrado ainda.</p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Salvar
        </button>
      </div>
    </Modal>
  )
}
