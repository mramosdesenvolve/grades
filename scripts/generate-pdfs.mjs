// Gera 1 PDF por unidade (Cápsula, Barra da Tijuca, Niterói, Politécnico)
// com 3 blocos: (a) todas as grades de turma (3/página), (b) todas as
// grades de professor com regência+planejamento (3/página), (c) relatório
// de carga horária — replicando fielmente a lógica visual do app
// (PrintAllGrids.tsx, PrintTeacherReport.tsx, teacherReport.ts, conflicts.ts).
import pg from 'pg'
import puppeteer from 'puppeteer'
import path from 'node:path'
import fs from 'node:fs'

const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env
const client = new pg.Client({
  host: PGHOST,
  port: Number(PGPORT ?? 5432),
  user: PGUSER ?? 'postgres',
  password: PGPASSWORD,
  database: PGDATABASE ?? 'postgres',
  ssl: { rejectUnauthorized: false },
})

const OUT_DIR = process.argv[2] || '.'
fs.mkdirSync(OUT_DIR, { recursive: true })

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
const TIME_SLOTS = [
  { id: 'm1', shift: 'Matutino', label: '07h15' },
  { id: 'm2', shift: 'Matutino', label: '08h05' },
  { id: 'm3', shift: 'Matutino', label: '08h55' },
  { id: 'm4', shift: 'Matutino', label: '10h15' },
  { id: 'm5', shift: 'Matutino', label: '11h05' },
  { id: 'm6', shift: 'Matutino', label: '11h55' },
  { id: 'v1', shift: 'Vespertino', label: '13h00' },
  { id: 'v2', shift: 'Vespertino', label: '13h50' },
  { id: 'v3', shift: 'Vespertino', label: '14h40' },
  { id: 'v4', shift: 'Vespertino', label: '15h50' },
  { id: 'v5', shift: 'Vespertino', label: '16h40' },
  { id: 'v6', shift: 'Vespertino', label: '17h30' },
]

function entryWeight(e) { return e.week === 'AMBAS' ? 1 : 0.5 }
function fmtHours(n) {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  return sign + (Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ','))
}
function teacherChargeReport(t, schedule) {
  const own = schedule.filter((e) => e.teacher_id === t.id)
  const regencia = own.filter((e) => e.type === 'aula').reduce((s, e) => s + entryWeight(e), 0)
  if (t.is_orientador) {
    const concreteOther = own
      .filter((e) => e.type === 'planejamento' || e.type === 'orientacao')
      .reduce((s, e) => s + entryWeight(e), 0)
    const adminGap = Math.max(0, Number(t.orientador_target_hours) - regencia - concreteOther)
    const planejamento = concreteOther + adminGap
    const demanda2027 = Math.max(regencia + concreteOther, Number(t.orientador_target_hours))
    return { regencia, planejamento, demanda2027, saldo: demanda2027 - Number(t.contracted_hours_2026), planejamentoLabel: 'Planejamento e Orientação' }
  }
  const planejamento = own.filter((e) => e.type === 'planejamento').reduce((s, e) => s + entryWeight(e), 0)
  const demanda2027 = regencia + planejamento
  return { regencia, planejamento, demanda2027, saldo: demanda2027 - Number(t.contracted_hours_2026), planejamentoLabel: 'Planejamento' }
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff !important; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1e293b; margin: 0; }
  .page { padding: 8mm 10mm; }
  .section-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin: 0 0 6px; }
  .grid-item { break-inside: avoid; margin-bottom: 6mm; }
  .grid-item h3 { margin: 0 0 3px; font-size: 11px; font-weight: 700; color: #1e293b; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 7px; }
  table.grid th, table.grid td { border: 1px solid #cbd5e1; padding: 2px 3px; text-align: left; vertical-align: top; }
  table.grid th { background: #f1f5f9; font-weight: 600; }
  table.grid td.hor { font-weight: 600; white-space: nowrap; }
  .comp { font-weight: 600; }
  .week-badge { margin-left: 2px; border-radius: 3px; background: #e2e8f0; padding: 0 2px; font-size: 6px; }
  .teacher-name { color: #64748b; }
  .empty { color: #cbd5e1; }
  .page-break { break-after: page; }
  .report-block { margin-bottom: 4mm; break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3mm; }
  .report-block h2 { margin: 0; font-size: 13px; font-weight: 700; color: #1e293b; }
  .orientador-badge { margin-left: 6px; border-radius: 999px; background: #ede9fe; padding: 1px 6px; font-size: 9px; font-weight: 600; color: #6d28d9; }
  table.rep { margin-top: 6px; width: 100%; border-collapse: collapse; font-size: 10px; }
  table.rep th, table.rep td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: left; }
  table.rep th { background: #f1f5f9; font-weight: 600; }
  table.rep td.num { text-align: right; }
  .orientador-note { margin: 4px 0 0; font-size: 9px; font-style: italic; color: #94a3b8; }
  .stats { margin-top: 6px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 10px; }
  .stat { border-radius: 4px; background: #f8fafc; padding: 4px 6px; }
  .stat p { margin: 0; }
  .stat .v { font-weight: 600; color: #334155; }
  .stat .l { color: #94a3b8; }
  .stat.pos { background: #fef2f2; } .stat.pos .v { color: #dc2626; }
  .stat.neg { background: #fffbeb; } .stat.neg .v { color: #d97706; }
  .stat.zero { background: #ecfdf5; } .stat.zero .v { color: #059669; }
  h1.doc-title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 6mm; }
`

function classGridBlockHtml(classGroup, entries, components, teachers) {
  const slots = TIME_SLOTS.filter((s) => s.shift === classGroup.shift)
  const rows = slots
    .map((slot) => {
      const cells = WEEKDAYS.map((day) => {
        const cellEntries = entries.filter((e) => e.type === 'aula' && e.class_id === classGroup.id && e.day === day && e.time_slot_id === slot.id)
        if (cellEntries.length === 0) return `<td><span class="empty">—</span></td>`
        const html = cellEntries
          .map((e) => {
            const comp = components.find((c) => c.id === e.component_id)
            const teacher = teachers.find((t) => t.id === e.teacher_id)
            const weekBadge = e.week !== 'AMBAS' ? `<span class="week-badge">${e.week}</span>` : ''
            return `<div><span class="comp" style="color:${comp?.color ?? '#000'}">${esc(comp?.name)}</span>${weekBadge}<div class="teacher-name">${esc(teacher?.name)}</div></div>`
          })
          .join('')
        return `<td>${html}</td>`
      }).join('')
      return `<tr><td class="hor">${slot.label}</td>${cells}</tr>`
    })
    .join('')
  return `
    <div class="grid-item">
      <h3>${esc(classGroup.name)} · ${esc(classGroup.shift)}</h3>
      <table class="grid">
        <thead><tr><th>Hor.</th>${WEEKDAYS.map((d) => `<th>${d.slice(0, 3)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
}

function teacherGridBlockHtml(teacher, entries, components, classes) {
  const own = entries.filter((e) => e.teacher_id === teacher.id)
  const usesVespertino = own.some((e) => e.time_slot_id.startsWith('v'))
  const slots = usesVespertino ? TIME_SLOTS : TIME_SLOTS.filter((s) => s.shift === 'Matutino')
  const rows = slots
    .map((slot) => {
      const cells = WEEKDAYS.map((day) => {
        const cellEntries = own.filter((e) => e.day === day && e.time_slot_id === slot.id)
        if (cellEntries.length === 0) return `<td><span class="empty">—</span></td>`
        const html = cellEntries
          .map((e) => {
            const comp = e.component_id ? components.find((c) => c.id === e.component_id) : null
            const cls = e.class_id ? classes.find((c) => c.id === e.class_id) : null
            const weekBadge = e.week !== 'AMBAS' ? `<span class="week-badge">${e.week}</span>` : ''
            const label = e.type === 'orientacao' ? 'Orientação' : e.type === 'planejamento' ? `Planej. ${esc(comp?.name ?? '')}` : esc(comp?.name)
            const color = comp?.color ?? (e.type === 'orientacao' ? '#7c3aed' : '#000')
            const sub = cls ? `<div class="teacher-name">${esc(cls.name)}</div>` : ''
            return `<div><span class="comp" style="color:${color}">${label}</span>${weekBadge}${sub}</div>`
          })
          .join('')
        return `<td>${html}</td>`
      }).join('')
      return `<tr><td class="hor">${slot.label}</td>${cells}</tr>`
    })
    .join('')
  return `
    <div class="grid-item">
      <h3>${esc(teacher.name)}${teacher.is_orientador ? ' <span class="orientador-badge">Professor Orientador</span>' : ''}</h3>
      <table class="grid">
        <thead><tr><th>Hor.</th>${WEEKDAYS.map((d) => `<th>${d.slice(0, 3)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
}

function reportBlockHtml(teacher, schedule, components, classes) {
  const entries = schedule.filter((e) => e.teacher_id === teacher.id)
  const regenciaEntries = entries.filter((e) => e.type === 'aula' && e.class_id)
  const planningEntries = entries.filter((e) => e.type === 'planejamento' || e.type === 'orientacao')
  const { regencia, planejamento, planejamentoLabel, saldo } = teacherChargeReport(teacher, schedule)

  const groups = new Map()
  for (const e of regenciaEntries) {
    const comp = components.find((c) => c.id === e.component_id)?.name ?? '?'
    const className = classes.find((c) => c.id === e.class_id)?.name ?? '?'
    const key = `${comp}::${className}`
    const existing = groups.get(key)
    if (existing) existing.count += entryWeight(e)
    else groups.set(key, { comp, className, count: entryWeight(e) })
  }
  const planningGroups = new Map()
  for (const e of planningEntries) {
    const label = e.type === 'orientacao' ? 'Orientação' : components.find((c) => c.id === e.component_id)?.name ?? '?'
    planningGroups.set(label, (planningGroups.get(label) ?? 0) + entryWeight(e))
  }

  const rows = [
    ...Array.from(groups.values()).map((g) => `<tr><td>${esc(g.comp)}</td><td>${esc(g.className)}</td><td class="num">${fmtHours(g.count)}</td></tr>`),
    ...Array.from(planningGroups.entries()).map(([comp, count]) => `<tr><td>${esc(comp)}</td><td style="font-style:italic;color:#94a3b8">${comp === 'Orientação' ? '—' : 'Planejamento'}</td><td class="num">${fmtHours(count)}</td></tr>`),
  ]
  const rowsHtml = rows.length ? rows.join('') : `<tr><td colspan="3" style="color:#94a3b8">Nenhuma alocação na grade.</td></tr>`

  const saldoClass = saldo > 0 ? 'pos' : saldo < 0 ? 'neg' : 'zero'
  const saldoText = saldo > 0 ? `+${fmtHours(saldo)}h` : `${fmtHours(saldo)}h`
  const orientadorNote = teacher.is_orientador
    ? `<p class="orientador-note">Professor Orientador: o total-alvo é ${teacher.orientador_target_hours}h. O que estiver lançado na grade como Planejamento ou Orientação conta acima; o restante até o total-alvo é carga administrativa presumida.</p>`
    : ''

  return `
    <section class="report-block">
      <h2>${esc(teacher.name)}${teacher.is_orientador ? '<span class="orientador-badge">Professor Orientador</span>' : ''}</h2>
      <table class="rep">
        <thead><tr><th>Componente</th><th>Turma</th><th style="text-align:right">Aulas/semana</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${orientadorNote}
      <div class="stats">
        <div class="stat"><p class="v">${teacher.contracted_hours_2026}h</p><p class="l">Contratado 2026</p></div>
        <div class="stat"><p class="v">${fmtHours(regencia)}h</p><p class="l">Regência 2027</p></div>
        <div class="stat"><p class="v">${fmtHours(planejamento)}h</p><p class="l">${esc(planejamentoLabel)} 2027</p></div>
        <div class="stat ${saldoClass}"><p class="v">${saldoText}</p><p class="l">Saldo (2027 − 2026)</p></div>
      </div>
    </section>`
}

function paginate(items, perPage, renderItem, sectionTitle) {
  let html = ''
  items.forEach((item, i) => {
    const isBreak = i % perPage === perPage - 1 && i !== items.length - 1
    const isFirstOfPage = i % perPage === 0
    html += `<div class="${isBreak ? 'page-break' : ''}">`
    if (isFirstOfPage) html += `<p class="section-title">${esc(sectionTitle)}</p>`
    html += renderItem(item)
    html += `</div>`
  })
  return html
}

async function main() {
  await client.connect()

  const schoolsRes = await client.query('select id, name from public.schools order by name')
  const componentsRes = await client.query('select id, name, color from public.components')
  const components = componentsRes.rows

  const browser = await puppeteer.launch({ headless: true })

  for (const school of schoolsRes.rows) {
    const classesRes = await client.query('select id, name, shift from public.classes where school_id=$1 order by name', [school.id])
    const teachersRes = await client.query('select id, name, contracted_hours_2026, is_orientador, orientador_target_hours from public.teachers where school_id=$1 order by name', [school.id])
    const scheduleRes = await client.query('select id, type, week, day, time_slot_id, class_id, component_id, teacher_id from public.schedule_entries where school_id=$1', [school.id])

    const classes = classesRes.rows
    const teachers = teachersRes.rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const schedule = scheduleRes.rows

    const sectionA = classes.length
      ? paginate(classes, 3, (c) => classGridBlockHtml(c, schedule, components, teachers), `Grade de Horários — ${school.name}`)
      : '<p>Nenhuma turma cadastrada nesta unidade.</p>'

    const sectionB = teachers.length
      ? paginate(teachers, 3, (t) => teacherGridBlockHtml(t, schedule, components, classes), `Grades dos Professores — ${school.name}`)
      : '<p>Nenhum professor cadastrado nesta unidade.</p>'

    const sectionC = teachers.length
      ? teachers.map((t) => reportBlockHtml(t, schedule, components, classes)).join('')
      : '<p>Nenhum professor cadastrado nesta unidade.</p>'

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><style>${STYLE}</style></head>
<body>
  <div class="page">
    <h1 class="doc-title">Grades de Turma — ${esc(school.name)}</h1>
    ${sectionA}
  </div>
  <div class="page-break"></div>
  <div class="page">
    <h1 class="doc-title">Grades dos Professores (Regência + Planejamento) — ${esc(school.name)}</h1>
    ${sectionB}
  </div>
  <div class="page-break"></div>
  <div class="page">
    <h1 class="doc-title">Relatório de Carga Horária — ${esc(school.name)}</h1>
    ${sectionC}
  </div>
</body></html>`

    if (process.env.DEBUG_HTML) fs.writeFileSync(path.join(OUT_DIR, `${school.id}.html`), html)

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const outPath = path.join(OUT_DIR, `${school.id}.pdf`)
    await page.pdf({ path: outPath, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } })
    await page.close()
    console.log('gerado:', outPath)
  }

  await browser.close()
  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end().catch(() => {})
  process.exit(1)
})
