import { useEffect, useState } from 'react'
import {
  Building2,
  CalendarDays,
  Check,
  GraduationCap,
  LayoutGrid,
  LogOut,
  RefreshCw,
  Undo2,
  Users,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'

export type Page = 'schedule' | 'teachers' | 'classes' | 'components'

const items: { id: Page; label: string; icon: typeof CalendarDays }[] = [
  { id: 'schedule', label: 'Grade de Horários', icon: CalendarDays },
  { id: 'teachers', label: 'Professores', icon: Users },
  { id: 'classes', label: 'Turmas', icon: LayoutGrid },
  { id: 'components', label: 'Componentes', icon: GraduationCap },
]

export function Sidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const {
    data,
    activeSchoolId,
    setActiveSchoolId,
    accessibleSchoolIds,
    lastSavedAt,
    saveNow,
    undo,
    canUndo,
    undoLabel,
  } = useApp()
  const { user, signOut } = useAuth()
  const [justSaved, setJustSaved] = useState(false)

  const handleSave = () => {
    saveNow()
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1500)
  }

  // atalho Ctrl+Z / Cmd+Z para desfazer a última ação
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isUndoShortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z'
      if (!isUndoShortcut) return
      const target = e.target as HTMLElement | null
      const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (isTyping) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo])

  const savedLabel = new Date(lastSavedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const accessibleSchools = data.schools.filter((s) => accessibleSchoolIds.includes(s.id))

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white print:hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <CalendarDays size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 leading-tight">Grades</p>
          <p className="text-xs text-slate-400 leading-tight">Escolares</p>
        </div>
      </div>

      <div className="border-b border-slate-100 px-3 py-3">
        <label className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <Building2 size={12} /> Unidade
        </label>
        <select
          value={activeSchoolId}
          onChange={(e) => setActiveSchoolId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {accessibleSchools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              page === id
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          title={undoLabel ? `Desfazer: ${undoLabel}` : 'Nada para desfazer'}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Undo2 size={15} className="shrink-0" />
          <span className="truncate">Desfazer{undoLabel ? `: ${undoLabel}` : ''}</span>
        </button>
        <button
          onClick={handleSave}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            justSaved
              ? 'bg-emerald-50 text-emerald-600'
              : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {justSaved ? <Check size={15} /> : <RefreshCw size={15} />}
          {justSaved ? 'Sincronizado!' : 'Sincronizar agora'}
        </button>
        <p className="mt-1.5 text-center text-[11px] text-slate-400">
          Salvo no banco às {savedLabel}
        </p>
        {user && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="truncate px-1 text-[11px] text-slate-400">{user.email}</p>
            <button
              onClick={() => signOut()}
              className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              <LogOut size={13} /> Sair
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
