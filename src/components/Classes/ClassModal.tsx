import { useState } from 'react'
import { Modal } from '../common/Modal'
import type { ClassGroup, Shift } from '../../types'
import { useApp } from '../../context/AppContext'

export function ClassModal({
  classGroup,
  onClose,
}: {
  classGroup: ClassGroup | null
  onClose: () => void
}) {
  const { addClass, updateClass } = useApp()
  const [name, setName] = useState(classGroup?.name ?? '')
  const [shift, setShift] = useState<Shift>(classGroup?.shift ?? 'Matutino')
  const [year, setYear] = useState(classGroup?.year ?? '')

  const handleSubmit = () => {
    if (!name.trim()) return
    const payload = { name: name.trim(), shift, year: year.trim() }
    if (classGroup) updateClass(classGroup.id, payload)
    else addClass(payload)
    onClose()
  }

  return (
    <Modal title={classGroup ? 'Editar Turma' : 'Nova Turma'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nome da Turma</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Ex: 2º Ano A"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Turno</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value as Shift)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="Matutino">Matutino</option>
              <option value="Vespertino">Vespertino</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Série/Ano</label>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="opcional"
            />
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
