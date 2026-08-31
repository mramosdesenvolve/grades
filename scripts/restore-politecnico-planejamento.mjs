// Restaura os lançamentos de tipo 'planejamento' do Politécnico que foram
// apagados por engano (a exclusão de "apague todos os tempos de
// planejamento" de um pedido anterior não tinha pego essas 141 linhas —
// elas sobreviveram até agora e foram removidas sem querer). Re-deriva a
// partir da Cápsula (mesma fonte usada por migrate-politecnico.mjs),
// atribuindo ao professor ATUAL de cada disciplina no Politécnico (já
// renomeado, não mais placeholder).
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

const SCHOOL_ID = 'politecnico'
// "Projeto de Vida" é tratada à parte (ver mais abaixo): no Politécnico ela
// está dividida em 2 professoras por trilha (ADM1/ADM2), então não entra
// nesta lista de "1 professor por disciplina".
const BASE_SUBJECTS = [
  'Artes', 'Biologia', 'Educação Física', 'Filosofia', 'Física', 'Geografia',
  'História', 'Inglês', 'Português', 'Química', 'Sociologia',
]
const V_SLOT = { m1: 'v1', m2: 'v2', m3: 'v3', m4: 'v4', m5: 'v5', m6: 'v6' }

async function main() {
  await client.connect()

  const compRows = await client.query('select id, name from public.components')
  const compIdByName = Object.fromEntries(compRows.rows.map((r) => [r.name, r.id]))

  const teacherRows = await client.query(
    'select id, name, component_ids from public.teachers where school_id = $1',
    [SCHOOL_ID],
  )

  let totalInserted = 0

  // 1. disciplinas de base comum + Projeto de Vida (1 professor por disciplina)
  for (const subject of BASE_SUBJECTS) {
    const compId = compIdByName[subject]
    const teacher = teacherRows.rows.find((t) => (t.component_ids ?? []).includes(compId))
    if (!teacher) {
      console.log('AVISO: nenhum professor atual encontrado para', subject, '— pulando')
      continue
    }
    const planRows = await client.query(
      `select e.week, e.day, e.time_slot_id
       from public.schedule_entries e
       join public.components comp on comp.id = e.component_id
       where e.school_id = 'capsula' and comp.name = $1 and e.type = 'planejamento'`,
      [subject],
    )
    for (const r of planRows.rows) {
      await client.query(
        `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
         values (gen_random_uuid(), $1, 'planejamento', $2, $3, $4, null, $5, $6)`,
        [SCHOOL_ID, r.week, r.day, r.time_slot_id, compId, teacher.id],
      )
      totalInserted++
    }
    console.log(subject, '->', teacher.name, ':', planRows.rows.length, 'lançamentos')
  }

  // 1b. Projeto de Vida: dividida em 2 professoras por trilha no Politécnico
  // (Jady = ADM1, Dandara = ADM2), espelhando a mesma trilha usada na
  // Cápsula (IA -> Gabriela, MMD -> vaga) para as aulas dessas turmas.
  const pvId = compIdByName['Projeto de Vida']
  const jady = teacherRows.rows.find((t) => t.name === 'Jady Louise Melquiades da Silva')
  const dandara = teacherRows.rows.find((t) => t.name === 'Dandara Da Silva Ferreira')
  const PV_TRACKS = [
    { capsulaTeacher: 'Gabriela Campos e Silva', politecnicoTeacher: jady },
    { capsulaTeacher: 'Professor(a) de Projeto de Vida - MMD (vaga em aberto)', politecnicoTeacher: dandara },
  ]
  for (const { capsulaTeacher, politecnicoTeacher } of PV_TRACKS) {
    if (!politecnicoTeacher) {
      console.log('AVISO: professora atual não encontrada para trilha de Projeto de Vida (', capsulaTeacher, ') — pulando')
      continue
    }
    const planRows = await client.query(
      `select e.week, e.day, e.time_slot_id
       from public.schedule_entries e
       join public.teachers t on t.id = e.teacher_id
       where t.school_id = 'capsula' and t.name = $1 and e.type = 'planejamento'`,
      [capsulaTeacher],
    )
    for (const r of planRows.rows) {
      await client.query(
        `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
         values (gen_random_uuid(), $1, 'planejamento', $2, $3, $4, null, $5, $6)`,
        [SCHOOL_ID, r.week, r.day, r.time_slot_id, pvId, politecnicoTeacher.id],
      )
      totalInserted++
    }
    console.log('Projeto de Vida (', capsulaTeacher, ') ->', politecnicoTeacher.name, ':', planRows.rows.length, 'lançamentos')
  }

  // 2. Matemática (1 única professora, planejamento vai para o turno vespertino)
  const matId = compIdByName['Matemática']
  const mathTeacher = teacherRows.rows.find((t) => (t.component_ids ?? []).includes(matId))
  if (mathTeacher) {
    const mathPlanRows = await client.query(
      `select e.week, e.day, e.time_slot_id
       from public.schedule_entries e
       join public.components comp on comp.id = e.component_id
       where e.school_id = 'capsula' and comp.name = 'Matemática' and e.type = 'planejamento'`,
    )
    for (const r of mathPlanRows.rows) {
      const timeSlotId = V_SLOT[r.time_slot_id] ?? r.time_slot_id
      await client.query(
        `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
         values (gen_random_uuid(), $1, 'planejamento', $2, $3, $4, null, $5, $6)`,
        [SCHOOL_ID, r.week, r.day, timeSlotId, matId, mathTeacher.id],
      )
      totalInserted++
    }
    console.log('Matemática ->', mathTeacher.name, ':', mathPlanRows.rows.length, 'lançamentos (turno vespertino)')
  } else {
    console.log('AVISO: nenhum professor atual encontrado para Matemática — pulando')
  }

  console.log('TOTAL inserido:', totalInserted)

  const total = await client.query(
    "select type, count(*) from public.schedule_entries where school_id='politecnico' group by type",
  )
  console.log('Contagem final por tipo:', total.rows)

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end().catch(() => {})
  process.exit(1)
})
