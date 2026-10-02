import type { Worksheet } from 'exceljs'
import { TIME_SLOTS } from '../data/seed'
import { WEEKDAYS } from '../types'
import type { AppData, ClassGroup, ScheduleEntry, Teacher } from '../types'
import { entryWeight } from './conflicts'
import { teacherChargeReport } from './teacherReport'

const NAVY = 'FF1F2937'
const WHITE = 'FFFFFFFF'
const BORDER_COLOR = 'FFCBD5E1'
const SOFT = 'FFF1F5F9'

const TYPE_LABEL: Record<string, string> = {
  aula: 'Regência',
  planejamento: 'Planejamento',
  orientacao: 'Orientação',
}

const border = {
  top: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  left: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  right: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
}

/** clareia uma cor #RRGGBB misturando com branco (0 = original, 1 = branco) */
function tint(hex: string | undefined, amount = 0.82): string {
  const h = (hex ?? '#94a3b8').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const mix = (v: number) => Math.round(v + (255 - v) * amount)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return 'FF' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function sheetName(raw: string, used: Set<string>): string {
  const base = raw.replace(/[\\/?*[\]:]/g, '-').slice(0, 28).trim() || 'Planilha'
  let name = base
  let i = 2
  while (used.has(name.toLowerCase())) name = `${base.slice(0, 26)} ${i++}`
  used.add(name.toLowerCase())
  return name
}

function styleHeaderRow(row: ReturnType<Worksheet['getRow']>) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = border
  })
  row.height = 22
}

export interface ExcelExportParams {
  data: AppData
  schoolId: string
  conflicts: Set<string>
  dailyOverloadEntries: Set<string>
  lunchBreakViolations: Set<string>
  gapSlots: Set<string>
}

export async function exportScheduleExcel(params: ExcelExportParams) {
  const { data, schoolId, conflicts, dailyOverloadEntries, lunchBreakViolations, gapSlots } = params
  const ExcelJS = (await import('exceljs')).default

  const school = data.schools.find((s) => s.id === schoolId)
  const schoolName = school?.name ?? schoolId
  const classes = data.classes
    .filter((c) => c.schoolId === schoolId)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const teachers = data.teachers
    .filter((t) => t.schoolId === schoolId)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const schedule = data.schedule.filter((e) => e.schoolId === schoolId)

  const compById = new Map(data.components.map((c) => [c.id, c]))
  const teacherById = new Map(data.teachers.map((t) => [t.id, t]))
  const classById = new Map(data.classes.map((c) => [c.id, c]))
  const slotById = new Map(TIME_SLOTS.map((s) => [s.id, s]))
  const dayOrder = new Map(WEEKDAYS.map((d, i) => [d, i]))
  const slotOrder = new Map(TIME_SLOTS.map((s, i) => [s.id, i]))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Grades Escolares'
  wb.created = new Date()
  const used = new Set<string>()

  const weekLabel = (e: ScheduleEntry) => (e.week === 'AMBAS' ? 'Ambas' : `Semana ${e.week}`)
  const compName = (e: ScheduleEntry) => compById.get(e.componentId ?? '')?.name ?? (e.type === 'orientacao' ? 'Orientação' : '?')

  // ---------------------------------------------------------------- Resumo
  const wsResumo = wb.addWorksheet(sheetName('Resumo', used), { views: [{ showGridLines: false }] })
  wsResumo.columns = [{ width: 34 }, { width: 22 }, { width: 60 }]
  wsResumo.mergeCells('A1:C1')
  const title = wsResumo.getCell('A1')
  title.value = `Grade de Horários — ${schoolName}`
  title.font = { bold: true, size: 16, color: { argb: NAVY } }
  wsResumo.getRow(1).height = 28
  wsResumo.getCell('A2').value = `Gerado em ${new Date().toLocaleString('pt-BR')}`
  wsResumo.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } }

  const alertRows: [string, number][] = [
    ['Conflitos de professor (mesmo horário em 2 lugares)', conflicts.size],
    ['Excesso diário (> 8 tempos)', dailyOverloadEntries.size],
    ['Sem horário de almoço (m6 + v1)', lunchBreakViolations.size],
    ['Horários vagos entre compromissos', gapSlots.size],
  ]
  const infoRows: [string, string | number][] = [
    ['Unidade', schoolName],
    ['Turmas', classes.length],
    ['Professores', teachers.length],
    ['Lançamentos de regência', schedule.filter((e) => e.type === 'aula').length],
    ['Lançamentos de planejamento / orientação', schedule.filter((e) => e.type !== 'aula').length],
  ]
  let r = 4
  wsResumo.getCell(`A${r}`).value = 'Visão geral'
  styleHeaderRow(wsResumo.getRow(r))
  wsResumo.getCell(`B${r}`).value = ''
  wsResumo.getCell(`B${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  r++
  for (const [k, v] of infoRows) {
    wsResumo.getCell(`A${r}`).value = k
    wsResumo.getCell(`B${r}`).value = v
    wsResumo.getCell(`A${r}`).border = border
    wsResumo.getCell(`B${r}`).border = border
    wsResumo.getCell(`B${r}`).alignment = { horizontal: 'left' }
    r++
  }
  r++
  wsResumo.getCell(`A${r}`).value = 'Alertas (regras do sistema)'
  wsResumo.getCell(`B${r}`).value = 'Ocorrências'
  styleHeaderRow(wsResumo.getRow(r))
  r++
  for (const [k, v] of alertRows) {
    wsResumo.getCell(`A${r}`).value = k
    wsResumo.getCell(`B${r}`).value = v
    wsResumo.getCell(`A${r}`).border = border
    wsResumo.getCell(`B${r}`).border = border
    wsResumo.getCell(`B${r}`).alignment = { horizontal: 'left' }
    wsResumo.getCell(`B${r}`).font = { bold: true, color: { argb: v > 0 ? 'FFB45309' : 'FF047857' } }
    r++
  }
  r++
  wsResumo.getCell(`A${r}`).value = 'Planilhas deste arquivo'
  wsResumo.getRow(r).getCell(1).font = { bold: true }
  r++
  const guide = [
    ['Lançamentos', 'Tabela completa (1 linha por aula/planejamento) com filtros — ideal para tabela dinâmica'],
    ['Carga Horária', 'Regência, planejamento, contratado e saldo por professor (regra dos 60%)'],
    ['Alertas', 'Conflitos e alertas trabalhistas, detalhados'],
    ['Turma <nome>', 'Grade semanal de cada turma'],
    ['Professores', 'Grade semanal de cada professor (regência + planejamento)'],
  ]
  for (const [a, b] of guide) {
    wsResumo.getCell(`A${r}`).value = a
    wsResumo.getCell(`A${r}`).font = { bold: true }
    wsResumo.getCell(`C${r}`).value = b
    r++
  }

  // ----------------------------------------------------------- Lançamentos
  const wsFlat = wb.addWorksheet(sheetName('Lançamentos', used))
  wsFlat.columns = [
    { header: 'Turma', key: 'turma', width: 16 },
    { header: 'Dia', key: 'dia', width: 10 },
    { header: 'Horário', key: 'hora', width: 9 },
    { header: 'Turno', key: 'turno', width: 12 },
    { header: 'Semana', key: 'semana', width: 11 },
    { header: 'Tipo', key: 'tipo', width: 13 },
    { header: 'Componente', key: 'comp', width: 30 },
    { header: 'Categoria', key: 'cat', width: 17 },
    { header: 'Professor', key: 'prof', width: 38 },
    { header: 'Peso semanal', key: 'peso', width: 13 },
  ]
  styleHeaderRow(wsFlat.getRow(1))
  const sorted = [...schedule].sort((a, b) => {
    const ca = classById.get(a.classId ?? '')?.name ?? '~'
    const cb = classById.get(b.classId ?? '')?.name ?? '~'
    return (
      ca.localeCompare(cb, 'pt-BR') ||
      (dayOrder.get(a.day) ?? 0) - (dayOrder.get(b.day) ?? 0) ||
      (slotOrder.get(a.timeSlotId) ?? 0) - (slotOrder.get(b.timeSlotId) ?? 0) ||
      a.week.localeCompare(b.week)
    )
  })
  for (const e of sorted) {
    const comp = compById.get(e.componentId ?? '')
    const row = wsFlat.addRow({
      turma: classById.get(e.classId ?? '')?.name ?? '—',
      dia: e.day,
      hora: slotById.get(e.timeSlotId)?.label ?? e.timeSlotId,
      turno: slotById.get(e.timeSlotId)?.shift ?? '',
      semana: weekLabel(e),
      tipo: TYPE_LABEL[e.type] ?? e.type,
      comp: compName(e),
      cat: comp?.category ?? '',
      prof: teacherById.get(e.teacherId)?.name ?? '?',
      peso: entryWeight(e),
    })
    row.eachCell((cell) => {
      cell.border = border
      cell.alignment = { vertical: 'top', wrapText: false }
    })
    if (conflicts.has(e.id)) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
      })
    }
  }
  wsFlat.views = [{ state: 'frozen', ySplit: 1 }]
  wsFlat.autoFilter = { from: 'A1', to: 'J1' }

  // --------------------------------------------------------- Carga Horária
  const wsCarga = wb.addWorksheet(sheetName('Carga Horária', used))
  wsCarga.columns = [
    { header: 'Professor', width: 38 },
    { header: 'Contratado 2026 (h)', width: 16 },
    { header: 'Regência (h)', width: 14 },
    { header: 'Planejamento (h)', width: 16 },
    { header: 'Demanda 2027 (h)', width: 16 },
    { header: 'Saldo (demanda − contrato)', width: 20 },
    { header: 'Planej. / Regência', width: 16 },
    { header: 'Situação', width: 40 },
  ]
  styleHeaderRow(wsCarga.getRow(1))
  teachers.forEach((t, idx) => {
    const rep = teacherChargeReport(t, schedule)
    const regencia = rep.regencia
    const planej = rep.planejamento
    const rowNum = idx + 2
    const row = wsCarga.addRow([
      t.name,
      t.contractedHours2026,
      regencia,
      planej,
      rep.demanda2027,
      { formula: `E${rowNum}-B${rowNum}` },
      { formula: `IF(C${rowNum}=0,"",D${rowNum}/C${rowNum})` },
      '',
    ])
    row.getCell(7).numFmt = '0%'
    const saldo = rep.saldo
    const ratio = regencia > 0 ? planej / regencia : null
    const notes: string[] = []
    if (saldo > 0) notes.push(`Precisa ampliar +${saldo}h`)
    else if (saldo < 0) notes.push(`Contrato ${Math.abs(saldo)}h acima da demanda`)
    else notes.push('Contrato cobre a demanda')
    if (!t.isOrientador && ratio !== null && Math.abs(ratio - 0.6) > 0.05) notes.push(`planejamento ≠ 60% da regência`)
    row.getCell(8).value = notes.join(' · ')
    row.eachCell((cell, col) => {
      cell.border = border
      if (col > 1 && col < 8) cell.alignment = { horizontal: 'center' }
    })
    row.getCell(6).font = {
      bold: true,
      color: { argb: saldo > 0 ? 'FFB91C1C' : saldo < 0 ? 'FFB45309' : 'FF047857' },
    }
  })
  wsCarga.views = [{ state: 'frozen', ySplit: 1 }]
  wsCarga.autoFilter = { from: 'A1', to: 'H1' }

  // ---------------------------------------------------------------- Alertas
  const wsAlertas = wb.addWorksheet(sheetName('Alertas', used))
  wsAlertas.columns = [
    { header: 'Tipo de alerta', width: 30 },
    { header: 'Professor', width: 38 },
    { header: 'Dia', width: 10 },
    { header: 'Horário', width: 9 },
    { header: 'Semana', width: 11 },
    { header: 'Detalhe', width: 52 },
  ]
  styleHeaderRow(wsAlertas.getRow(1))
  const addAlert = (tipo: string, e: ScheduleEntry, detalhe: string) => {
    const row = wsAlertas.addRow([
      tipo,
      teacherById.get(e.teacherId)?.name ?? '?',
      e.day,
      slotById.get(e.timeSlotId)?.label ?? e.timeSlotId,
      weekLabel(e),
      detalhe,
    ])
    row.eachCell((c) => (c.border = border))
  }
  const describe = (e: ScheduleEntry) =>
    `${TYPE_LABEL[e.type] ?? e.type}: ${compName(e)}${
      e.classId ? ` — ${classById.get(e.classId)?.name ?? '?'}` : ''
    }`
  for (const e of schedule) {
    if (conflicts.has(e.id)) addAlert('Conflito de professor', e, describe(e))
    if (dailyOverloadEntries.has(e.id)) addAlert('Excesso diário (> 8 tempos)', e, describe(e))
    if (lunchBreakViolations.has(e.id)) addAlert('Sem horário de almoço', e, describe(e))
  }
  for (const key of gapSlots) {
    const [teacherId, day, slotId, week] = key.split('::')
    wsAlertas.addRow([
      'Horário vago no turno',
      teacherById.get(teacherId)?.name ?? '?',
      day,
      slotById.get(slotId)?.label ?? slotId,
      `Semana ${week}`,
      'Janela entre dois compromissos do mesmo turno',
    ]).eachCell((c) => (c.border = border))
  }
  if (wsAlertas.rowCount === 1) {
    wsAlertas.addRow(['Nenhum alerta encontrado ✔'])
  }
  wsAlertas.views = [{ state: 'frozen', ySplit: 1 }]

  // ------------------------------------------------------ grade (helper)
  type CellFn = (day: string, slotId: string) => { lines: string[]; color?: string }

  const writeGrid = (
    ws: Worksheet,
    startRow: number,
    heading: string,
    slots: typeof TIME_SLOTS,
    cell: CellFn,
  ): number => {
    ws.mergeCells(startRow, 1, startRow, 6)
    const h = ws.getCell(startRow, 1)
    h.value = heading
    h.font = { bold: true, size: 13, color: { argb: NAVY } }
    h.alignment = { vertical: 'middle' }
    ws.getRow(startRow).height = 24

    const head = ws.getRow(startRow + 1)
    head.values = ['Horário', ...WEEKDAYS]
    styleHeaderRow(head)

    slots.forEach((slot, i) => {
      const row = ws.getRow(startRow + 2 + i)
      const first = row.getCell(1)
      first.value = `${slot.label}\n${slot.shift}`
      first.font = { bold: true, color: { argb: NAVY } }
      first.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } }
      first.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      first.border = border
      let maxLines = 1
      WEEKDAYS.forEach((day, di) => {
        const c = row.getCell(2 + di)
        const { lines, color } = cell(day, slot.id)
        c.value = lines.length ? lines.join('\n') : ''
        c.alignment = { vertical: 'top', wrapText: true }
        c.border = border
        c.font = { size: 10 }
        if (color) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
        maxLines = Math.max(maxLines, lines.length ? lines.join('\n').split('\n').length + 1 : 1)
      })
      row.height = Math.max(34, Math.min(maxLines, 9) * 14)
    })
    return startRow + 2 + slots.length
  }

  const gridColumns = [{ width: 12 }, ...WEEKDAYS.map(() => ({ width: 34 }))]

  // --------------------------------------------------------- Turmas (abas)
  const classCell = (cls: ClassGroup): CellFn => (day, slotId) => {
    const entries = schedule.filter(
      (e) => e.type === 'aula' && e.classId === cls.id && e.day === day && e.timeSlotId === slotId,
    )
    const lines: string[] = []
    const groups = new Map<string, ScheduleEntry[]>()
    for (const e of entries) {
      const k = `${e.week}::${e.componentId}`
      groups.set(k, [...(groups.get(k) ?? []), e])
    }
    const split = entries.some((e) => e.week !== 'AMBAS')
    for (const list of [...groups.values()].sort((a, b) => a[0].week.localeCompare(b[0].week))) {
      const e = list[0]
      const profs = list.map((x) => teacherById.get(x.teacherId)?.name ?? '?').join(' + ')
      lines.push(`${split && e.week !== 'AMBAS' ? `[Sem. ${e.week}] ` : ''}${compName(e)}`)
      lines.push(`   ${profs}`)
    }
    const color = entries.length && !split ? tint(compById.get(entries[0].componentId ?? '')?.color) : undefined
    return { lines, color: color ?? (entries.length ? SOFT : undefined) }
  }

  for (const cls of classes) {
    const ws = wb.addWorksheet(sheetName(`Turma ${cls.name.replace(/^Turma\s*/i, '')}`, used))
    ws.columns = gridColumns
    ws.views = [{ showGridLines: false }]
    const slots = TIME_SLOTS.filter((s) => s.shift === cls.shift)
    writeGrid(ws, 1, `${cls.name} · ${cls.shift} — ${schoolName}`, slots, classCell(cls))
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  }

  // ------------------------------------------------- Professores (1 aba)
  const wsProf = wb.addWorksheet(sheetName('Professores', used))
  wsProf.columns = gridColumns
  wsProf.views = [{ showGridLines: false }]
  const teacherCell = (t: Teacher): CellFn => (day, slotId) => {
    const entries = schedule.filter((e) => e.teacherId === t.id && e.day === day && e.timeSlotId === slotId)
    const split = entries.some((e) => e.week !== 'AMBAS')
    const lines: string[] = []
    for (const e of [...entries].sort((a, b) => a.week.localeCompare(b.week))) {
      const wk = split && e.week !== 'AMBAS' ? `[Sem. ${e.week}] ` : ''
      if (e.type === 'aula') {
        lines.push(`${wk}${compName(e)}`)
        lines.push(`   ${classById.get(e.classId ?? '')?.name ?? '?'}`)
      } else if (e.type === 'orientacao') {
        lines.push(`${wk}Orientação`)
      } else {
        lines.push(`${wk}Planejamento · ${compName(e)}`)
      }
    }
    const hasAula = entries.some((e) => e.type === 'aula')
    const color = !entries.length ? undefined : hasAula ? 'FFDBEAFE' : 'FFFEF3C7'
    return { lines, color }
  }
  let cursor = 1
  wsProf.mergeCells(cursor, 1, cursor, 6)
  wsProf.getCell(cursor, 1).value = `Grade por professor — ${schoolName}  (azul = regência · amarelo = planejamento/orientação)`
  wsProf.getCell(cursor, 1).font = { italic: true, color: { argb: 'FF64748B' } }
  cursor += 2
  for (const t of teachers) {
    const own = schedule.filter((e) => e.teacherId === t.id)
    const hasAfternoon = own.some((e) => slotById.get(e.timeSlotId)?.shift === 'Vespertino')
    const slots = TIME_SLOTS.filter((s) => s.shift === 'Matutino' || hasAfternoon)
    const reg = own.filter((e) => e.type === 'aula').reduce((s, e) => s + entryWeight(e), 0)
    const pl = own.filter((e) => e.type !== 'aula').reduce((s, e) => s + entryWeight(e), 0)
    const heading = `${t.name}${t.isOrientador ? ' · Orientador' : ''}   |   Regência ${reg}h · Planejamento ${pl}h · Contratado ${t.contractedHours2026}h`
    cursor = writeGrid(wsProf, cursor, heading, slots, teacherCell(t)) + 2
  }
  wsProf.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

  // ---------------------------------------------------------------- download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const stamp = new Date().toISOString().slice(0, 10)
  const slug = schoolName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `grades-${slug}-${stamp}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
