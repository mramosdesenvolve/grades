import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ClipboardList,
  Download,
  FileJson,
  LayoutGrid,
  Printer,
  Upload,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { WeekType } from '../../types'
import { ScheduleGrid } from './ScheduleGrid'
import { PrintAllGrids } from './PrintAllGrids'
import { PrintTeacherReport } from './PrintTeacherReport'
import { exportScheduleCsv } from '../../utils/csv'
import { downloadJson, readJsonFile } from '../../utils/backup'

type ViewMode = 'class' | 'teacher' | 'planning'
type BulkPrintTarget = 'grids' | 'report' | null

export function SchedulePage() {
  const { data, activeSchoolId, conflicts, replaceAllData } = useApp()
  const [viewMode, setViewMode] = useState<ViewMode>('class')
  const [entityId, setEntityId] = useState('')
  const [week, setWeek] = useState<WeekType>('A')
  const [bulkPrint, setBulkPrint] = useState<BulkPrintTarget>(null)

  const schoolClasses = data.classes.filter((c) => c.schoolId === activeSchoolId)
  const schoolTeachers = data.teachers.filter((t) => t.schoolId === activeSchoolId)
  const entities = viewMode === 'class' ? schoolClasses : schoolTeachers
  const entityKind = viewMode === 'class' ? 'classId' : 'teacherId'

  useEffect(() => {
    if (entities.length > 0 && !entities.find((e) => e.id === entityId)) {
      setEntityId(entities[0].id)
    }
    if (entities.length === 0) setEntityId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeSchoolId, data.classes, data.teachers])

  useEffect(() => {
    if (!bulkPrint) return
    const raf = requestAnimationFrame(() => window.print())
    return () => cancelAnimationFrame(raf)
  }, [bulkPrint])

  useEffect(() => {
    const handler = () => setBulkPrint(null)
    window.addEventListener('afterprint', handler)
    return () => window.removeEventListener('afterprint', handler)
  }, [])

  const selectedClass = viewMode === 'class' ? schoolClasses.find((c) => c.id === entityId) : null
  const schoolName = data.schools.find((s) => s.id === activeSchoolId)?.name ?? ''

  const conflictCount = useMemo(() => {
    if (!entityId) return 0
    return data.schedule.filter(
      (e) => conflicts.has(e.id) && e[entityKind as 'classId' | 'teacherId'] === entityId,
    ).length
  }, [data.schedule, conflicts, entityId, entityKind])

  const entityName = entities.find((e) => e.id === entityId)?.name ?? ''

  const handleExportCsv = () => {
    if (!entityId) return
    exportScheduleCsv({
      schedule: data.schedule,
      components: data.components,
      teachers: data.teachers,
      classes: data.classes,
      week,
      mode: viewMode,
      entityId,
      entityName,
    })
  }

  const handleImport = (file: File) => {
    readJsonFile(file)
      .then((imported) => replaceAllData(imported))
      .catch((err) => alert(err.message))
  }

  const normalPrintClass = bulkPrint ? 'print:hidden' : ''

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Grade de Horários</h1>
          <p className="text-sm text-slate-500">{schoolName} · por turma ou por professor</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Upload size={15} /> Importar
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImport(file)
                e.target.value = ''
              }}
            />
          </label>
          <button
            onClick={() => downloadJson(data)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <FileJson size={15} /> Backup JSON
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!entityId}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={15} /> CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={!entityId}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <button
          onClick={() => setBulkPrint('grids')}
          disabled={schoolClasses.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <LayoutGrid size={15} /> Exportar Todas as Grades (PDF)
        </button>
        <button
          onClick={() => setBulkPrint('report')}
          disabled={schoolTeachers.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <ClipboardList size={15} /> Relatório de Carga (PDF)
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(['class', 'teacher', 'planning'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === m ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {m === 'class' ? 'Por Turma' : m === 'teacher' ? 'Professor · Regência' : 'Professor · Planejamento'}
            </button>
          ))}
        </div>

        <select
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {entities.length === 0 && <option value="">Nenhum cadastrado</option>}
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
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

        {conflictCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">
            <AlertTriangle size={14} /> {conflictCount} conflito(s) de professor
          </span>
        )}
      </div>

      <div className={`hidden print:mb-4 ${bulkPrint ? '' : 'print:block'}`}>
        <h1 className="text-lg font-bold">
          Grade de Horários — {entityName} ({week === 'AMBAS' ? 'Semana A e B' : `Semana ${week}`}
          )
        </h1>
      </div>

      {entityId ? (
        <div className={normalPrintClass}>
          <ScheduleGrid
            mode={viewMode}
            entityId={entityId}
            week={week}
            shiftFilter={selectedClass?.shift}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          Cadastre {viewMode === 'class' ? 'turmas' : 'professores'} para montar a grade.
        </div>
      )}
      {viewMode === 'planning' && data.teachers.find((t) => t.id === entityId)?.componentIds
        .length === 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Este professor ainda não tem componentes vinculados.
        </p>
      )}

      {bulkPrint === 'grids' && (
        <div className="hidden print:block">
          <PrintAllGrids schoolId={activeSchoolId} />
        </div>
      )}
      {bulkPrint === 'report' && (
        <div className="hidden print:block">
          <PrintTeacherReport schoolId={activeSchoolId} />
        </div>
      )}
    </div>
  )
}
