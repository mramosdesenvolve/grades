// v6: Matemática primeiro (matching bipartido rápido sobre as 11 células
// livres), depois — só no que sobra (7 células/turma) — PV+Projeto de Ano
// Letivo (2 pares GEMINADOS, semanas complementares) + Administração extra
// (as 3 restantes), com checagens cruzadas de trilha (PV) e ano-parceiro
// (Administração/Projeto, mesmo professor de FTP).
import pg from 'pg'

const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env
const client = new pg.Client({
  host: PGHOST,
  port: Number(PGPORT ?? 5432),
  user: PGUSER ?? 'postgres',
  password: PGPASSWORD,
  database: PGDATABASE ?? 'postgres',
  ssl: { rejectUnauthorized: false },
})

const DAY_ORDER = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
const SLOT_ORDER = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']
const cellKey = (c) => `${c.day}|${c.slot}`
function sortCells(cells) {
  return [...cells].sort((a, b) => {
    const da = DAY_ORDER.indexOf(a.day), db = DAY_ORDER.indexOf(b.day)
    if (da !== db) return da - db
    return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)
  })
}
function parseList(list) { return list.map((s) => { const [day, slot] = s.split(' '); return { day, slot } }) }

const YEARS = ['1', '2', '3']
const TRACKS = ['ADM1', 'ADM2']
const CLASSES = []
for (const y of YEARS) for (const t of TRACKS) CLASSES.push({ name: `Turma ${y}${t}`, year: y, track: t })

const FREE_11 = {
  'Turma 1ADM1': ['Quarta m3', 'Quarta m4', 'Quinta m1', 'Quinta m2', 'Quinta m3', 'Quinta m4', 'Quinta m5', 'Quinta m6', 'Sexta m4', 'Sexta m5', 'Sexta m6'],
  'Turma 1ADM2': ['Quarta m5', 'Quarta m6', 'Quinta m1', 'Quinta m4', 'Terça m5', 'Terça m6', 'Quinta m2', 'Sexta m3', 'Sexta m4', 'Sexta m5', 'Sexta m6'],
  'Turma 2ADM1': ['Quarta m5', 'Quarta m6', 'Quinta m1', 'Quinta m2', 'Quinta m3', 'Quinta m4', 'Quinta m5', 'Quinta m6', 'Sexta m1', 'Sexta m2', 'Sexta m3'],
  'Turma 2ADM2': ['Terça m2', 'Quinta m3', 'Quinta m5', 'Quinta m6', 'Terça m1', 'Sexta m1', 'Sexta m2', 'Sexta m3', 'Sexta m4', 'Sexta m5', 'Sexta m6'],
  'Turma 3ADM1': ['Quarta m1', 'Quarta m2', 'Sexta m5', 'Sexta m6', 'Quinta m2', 'Quinta m5', 'Quinta m6', 'Sexta m1', 'Sexta m2', 'Sexta m3', 'Sexta m4'],
  'Turma 3ADM2': ['Terça m3', 'Terça m4', 'Sexta m1', 'Sexta m2', 'Segunda m1', 'Segunda m2', 'Quinta m1', 'Quinta m3', 'Quinta m4', 'Quinta m5', 'Quinta m6'],
}
for (const k of Object.keys(FREE_11)) FREE_11[k] = sortCells(parseList(FREE_11[k]))

function partnerOf(className) {
  const c = CLASSES.find((x) => x.name === className)
  const partnerTrack = c.track === 'ADM1' ? 'ADM2' : 'ADM1'
  return `Turma ${c.year}${partnerTrack}`
}
function trackOf(className) { return CLASSES.find((x) => x.name === className).track }

function consecutivePairs(cells) {
  const set = new Set(cells.map(cellKey))
  const pairs = []
  for (const cell of cells) {
    const idx = SLOT_ORDER.indexOf(cell.slot)
    if (idx === -1 || idx === SLOT_ORDER.length - 1) continue
    const nextKey = cellKey({ day: cell.day, slot: SLOT_ORDER[idx + 1] })
    if (set.has(nextKey)) pairs.push([cell, { day: cell.day, slot: SLOT_ORDER[idx + 1] }])
  }
  return pairs
}
function twoDisjointPairs(cells) {
  const pairs = consecutivePairs(cells)
  const results = []
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const keysI = new Set(pairs[i].map(cellKey))
      if (!pairs[j].some((c) => keysI.has(cellKey(c)))) results.push([...pairs[i], ...pairs[j]])
    }
  }
  return results
}
// 4 tempos SEGUIDOS (mesmo dia, slots consecutivos) dentre as células disponíveis
function fourConsecutive(cells) {
  const set = new Set(cells.map(cellKey))
  const results = []
  const byDay = {}
  for (const c of cells) (byDay[c.day] ??= new Set()).add(c.slot)
  for (const [day, slots] of Object.entries(byDay)) {
    for (let i = 0; i + 3 < SLOT_ORDER.length; i++) {
      const run = SLOT_ORDER.slice(i, i + 4)
      if (run.every((s) => slots.has(s))) results.push(run.map((slot) => ({ day, slot })))
    }
  }
  return results
}

async function main() {
  await client.connect()

  const classRows = await client.query("select id, name from public.classes where school_id='politecnico'")
  const classIdByName = Object.fromEntries(classRows.rows.map((r) => [r.name, r.id]))
  const compRows = await client.query('select id, name from public.components')
  const compIdByName = Object.fromEntries(compRows.rows.map((r) => [r.name, r.id]))
  const admId = compIdByName['Administração']
  const projId = compIdByName['Projeto de Ano Letivo - ADM']
  const matId = compIdByName['Matemática']
  const pvId = compIdByName['Projeto de Vida']
  const teacherRows = await client.query("select id, name from public.teachers where school_id='politecnico'")
  const teacherIdByName = Object.fromEntries(teacherRows.rows.map((r) => [r.name, r.id]))
  const mathTeacherId = teacherIdByName['Jessica de Oliveira Santiago']
  const ftpTeacherByYear = {
    '1': teacherIdByName['Jessica Alves Caldas'],
    '2': teacherIdByName['Alexandre Santana da Silva'],
    '3': teacherIdByName['Professor(a) de FTP/Administração - 3º Ano (vaga em aberto)'],
  }
  const pvTeacherByTrack = {
    ADM1: teacherIdByName['Jady Louise Melquiades da Silva'],
    ADM2: teacherIdByName['Dandara Da Silva Ferreira'],
  }

  const del = await client.query(`
    delete from public.schedule_entries e
    using public.components comp
    where e.component_id = comp.id
      and e.school_id = 'politecnico'
      and (comp.name in ('Matemática', 'Projeto de Ano Letivo - ADM', 'Projeto de Vida')
           or (comp.name = 'Administração' and e.week = 'AMBAS'))
  `)
  console.log('Removidas para reconstruir:', del.rowCount)

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  // --- Estágio 1: Matemática via matching bipartido — tenta várias ordens
  //     aleatórias até achar uma cujo "resto" permita o Estágio 2 (pares
  //     geminados de PV/Projeto + Administração extra sem conflito).
  const trackGroups = TRACKS.map((t) => ({ t, classes: YEARS.map((y) => `Turma ${y}${t}`) }))

  function tryMathMatching() {
    const allCellSet = new Map()
    for (const c of CLASSES) for (const cell of FREE_11[c.name]) allCellSet.set(cellKey(cell), cell)
    const allCells = shuffle([...allCellSet.values()])
    const leftNodes = shuffle(CLASSES.flatMap((c) => Array(4).fill(c.name)))
    const adj = leftNodes.map((className) =>
      allCells.map((cell, idx) => (FREE_11[className].some((f) => cellKey(f) === cellKey(cell)) ? idx : -1)).filter((i) => i !== -1),
    )
    const matchRight = new Array(allCells.length).fill(-1)
    function tryKuhn(u, visited) {
      for (const v of adj[u]) {
        if (visited[v]) continue
        visited[v] = true
        if (matchRight[v] === -1 || tryKuhn(matchRight[v], visited)) { matchRight[v] = u; return true }
      }
      return false
    }
    let matched = 0
    for (let u = 0; u < leftNodes.length; u++) {
      const visited = new Array(allCells.length).fill(false)
      if (tryKuhn(u, visited)) matched++
    }
    if (matched !== leftNodes.length) return null
    const byClass = {}
    for (const c of CLASSES) byClass[c.name] = []
    for (let v = 0; v < matchRight.length; v++) if (matchRight[v] !== -1) byClass[leftNodes[matchRight[v]]].push(allCells[v])
    return byClass
  }

  function tryStage2(restByClass) {
    const order = shuffle(CLASSES.map((c) => c.name))
    const chosen = {}
    function backtrack(idx) {
      if (idx === order.length) return true
      const className = order[idx]
      const rest = restByClass[className]
      const pairCandidates = shuffle(twoDisjointPairs(rest))

      for (const pvProjetoCells of pairCandidates) {
        const pvProjKeys = new Set(pvProjetoCells.map(cellKey))
        const admin = rest.filter((c) => !pvProjKeys.has(cellKey(c)))
        if (admin.length !== 3) continue

        for (const pvWeek of ['A', 'B']) {
          let pvOk = true
          for (const other of trackGroups.find((g) => g.t === trackOf(className)).classes) {
            if (other === className || !chosen[other]) continue
            const otherPvKeys = new Set(chosen[other].pvProjeto.filter((x) => x.pvWeek === pvWeek).map((x) => cellKey(x.cell)))
            if (pvProjetoCells.some((c) => otherPvKeys.has(cellKey(c)))) { pvOk = false; break }
          }
          if (!pvOk) continue

          const partner = partnerOf(className)
          if (chosen[partner]) {
            const partnerBusyKeys = new Set([...chosen[partner].pvProjeto.map((x) => cellKey(x.cell)), ...chosen[partner].admin.map(cellKey)])
            if (admin.some((c) => partnerBusyKeys.has(cellKey(c)))) continue
            if (pvProjetoCells.some((c) => new Set(chosen[partner].admin.map(cellKey)).has(cellKey(c)))) continue

            const projWeek = pvWeek === 'A' ? 'B' : 'A'
            const partnerProjByCell = new Map(chosen[partner].pvProjeto.map((x) => [cellKey(x.cell), x.pvWeek === 'A' ? 'B' : 'A']))
            let projOk = true
            for (const c of pvProjetoCells) {
              const pw = partnerProjByCell.get(cellKey(c))
              if (pw !== undefined && pw === projWeek) { projOk = false; break }
            }
            if (!projOk) continue
          }

          chosen[className] = { pvProjeto: pvProjetoCells.map((cell) => ({ cell, pvWeek })), admin }
          if (backtrack(idx + 1)) return true
          delete chosen[className]
        }
      }
      return false
    }
    return backtrack(0) ? chosen : null
  }

  function hasConsecutivePair(cells) {
    return consecutivePairs(cells).length > 0
  }

  let mathCellsByClass = null
  let chosen = null
  const MAX_TRIES = 20000
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const math = tryMathMatching()
    if (!math) continue
    if (!CLASSES.every((c) => hasConsecutivePair(math[c.name]))) continue // Matemática precisa de pelo menos 1 par geminado por turma
    const restByClass = {}
    for (const c of CLASSES) {
      const mathKeys = new Set(math[c.name].map(cellKey))
      restByClass[c.name] = FREE_11[c.name].filter((cell) => !mathKeys.has(cellKey(cell)))
    }
    const stage2 = tryStage2(restByClass)
    if (stage2) { mathCellsByClass = math; chosen = stage2; console.log(`Solução encontrada na tentativa ${attempt + 1}.`); break }
  }
  if (!chosen) throw new Error(`Não encontrei distribuição válida em ${MAX_TRIES} tentativas (v6)`)
  console.log('Estágio 1+2 OK: Matemática, PV/Projeto (geminados) e Administração extra resolvidos para as 6 turmas.')

  let inserted = 0
  for (const c of CLASSES) {
    const classId = classIdByName[c.name]
    const ftpTeacherId = ftpTeacherByYear[c.year]
    const pvTeacherId = pvTeacherByTrack[c.track]
    const plan = chosen[c.name]

    for (const { cell, pvWeek } of plan.pvProjeto) {
      const projWeek = pvWeek === 'A' ? 'B' : 'A'
      await client.query(
        `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
         values (gen_random_uuid(), 'politecnico', 'aula', $1, $2, $3, $4, $5, $6)`,
        [pvWeek, cell.day, cell.slot, classId, pvId, pvTeacherId],
      )
      await client.query(
        `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
         values (gen_random_uuid(), 'politecnico', 'aula', $1, $2, $3, $4, $5, $6)`,
        [projWeek, cell.day, cell.slot, classId, projId, ftpTeacherId],
      )
      inserted += 2
    }
    for (const cell of plan.admin) {
      await client.query(
        `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
         values (gen_random_uuid(), 'politecnico', 'aula', 'AMBAS', $1, $2, $3, $4, $5)`,
        [cell.day, cell.slot, classId, admId, ftpTeacherId],
      )
      inserted++
    }
    for (const cell of mathCellsByClass[c.name]) {
      await client.query(
        `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
         values (gen_random_uuid(), 'politecnico', 'aula', 'AMBAS', $1, $2, $3, $4, $5)`,
        [cell.day, cell.slot, classId, matId, mathTeacherId],
      )
      inserted++
    }
  }
  console.log('Inseridas:', inserted)

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
