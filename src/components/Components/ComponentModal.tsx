import { useEffect, useState } from 'react'
import { Modal } from '../common/Modal'
import type { CurricularComponent } from '../../types'
import { useApp } from '../../context/AppContext'
import { BNCC_AREAS, colorForComponent } from '../../data/bnccAreas'

const CATEGORY_PRESETS = ['Base Comum', 'Formação Técnica', 'Projetos']

export function ComponentModal({
  component,
  onClose,
}: {
  component: CurricularComponent | null
  onClose: () => void
}) {
  const { data, activeSchoolId, addComponent, updateComponent } = useApp()
  const schoolTeachers = data.teachers.filter((t) => t.schoolId === activeSchoolId)
  const [name, setName] = useState(component?.name ?? '')
  const [category, setCategory] = useState(component?.category ?? 'Base Comum')
  const [customCategory, setCustomCategory] = useState('')
  const [color, setColor] = useState(component?.color ?? colorForComponent('', 'Base Comum'))
  const [colorTouched, setColorTouched] = useState(!!component)
  const [weeklyHours, setWeeklyHours] = useState(component?.weeklyHours ?? 2)
  const [planningHours, setPlanningHours] = useState(component?.planningHours ?? 0)
  const [teacherIds, setTeacherIds] = useState<string[]>(
    component ? data.teachers.filter((t) => t.componentIds.includes(component.id)).map((t) => t.id) : [],
  )

  const allCategories = Array.from(
    new Set([...CATEGORY_PRESETS, ...data.components.map((c) => c.category)]),
  )

  useEffect(() => {
    if (colorTouched) return
    const finalCategory = category === '__custom__' ? customCategory.trim() : category
    setColor(colorForComponent(name.trim(), finalCategory || 'Base Comum'))
  }, [name, category, customCategory, colorTouched])

  const toggleTeacher = (id: string) => {
    setTeacherIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSubmit = () => {
    const finalCategory = category === '__custom__' ? customCategory.trim() : category
    if (!name.trim() || !finalCategory) return
    const payload = {
      name: name.trim(),
      category: finalCategory,
      color,
      weeklyHours: Math.max(0, weeklyHours),
      planningHours: Math.max(0, planningHours),
    }
    if (component) updateComponent(component.id, payload, teacherIds)
    else addComponent(payload, teacherIds)
    onClose()
  }

  return (
    <Modal title={component ? 'Editar Componente' : 'Novo Componente'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Ex: Matemática"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__custom__">+ Nova categoria...</option>
            </select>
            {category === '__custom__' && (
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Nome da categoria"
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Carga Semanal (aulas)
            </label>
            <input
              type="number"
              min={0}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Carga Semanal de Planejamento (aulas)
          </label>
          <input
            type="number"
            min={0}
            value={planningHours}
            onChange={(e) => setPlanningHours(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="0"
          />
          <p className="mt-1 text-xs text-slate-400">
            Tempo semanal reservado ao professor para planejar este componente (não entra na
            grade de aulas).
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Cor (por área BNCC)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {BNCC_AREAS.map((area) => (
              <button
                key={area.id}
                type="button"
                title={area.label}
                onClick={() => {
                  setColor(area.color)
                  setColorTouched(true)
                }}
                className={`h-7 w-7 rounded-full border-2 ${
                  color === area.color ? 'border-slate-800' : 'border-transparent'
                }`}
                style={{ backgroundColor: area.color }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value)
                setColorTouched(true)
              }}
              className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-transparent"
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {BNCC_AREAS.find((a) => a.color === color)?.label ?? 'Cor personalizada'}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Professores vinculados (unidade atual)
          </label>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {schoolTeachers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeacher(t.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  teacherIds.includes(t.id)
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.name}
              </button>
            ))}
            {schoolTeachers.length === 0 && (
              <p className="text-xs text-slate-400">Nenhum professor cadastrado ainda.</p>
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
