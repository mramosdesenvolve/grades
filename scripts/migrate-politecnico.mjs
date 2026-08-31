// Constrói a grade do Politécnico com base na grade da Cápsula, mas:
// - sem trilhas IA/MMD: usa Administração (ADM1/ADM2 são só nomes de turma)
// - FTP/Administração: 1 professor por ANO (cobre as 2 turmas daquele ano), não por trilha
// - Orientador(a): é o professor de FTP do 2º ano
// - Matemática: uma única professora para as 6 turmas (gera conflitos, a resolver depois)
import pg from 'pg'
import crypto from 'node:crypto'

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

const CLASS_SWAP = {
  'Turma 1IA': 'Turma 1ADM1',
  'Turma 2IA': 'Turma 2ADM1',
  'Turma 3IA': 'Turma 3ADM1',
  'Turma 1MMD': 'Turma 1ADM2',
  'Turma 2MMD': 'Turma 2ADM2',
  'Turma 3MMD': 'Turma 3ADM2',
}

const BASE_SUBJECTS = [
  'Artes', 'Biologia', 'Educação Física', 'Filosofia', 'Física', 'Geografia',
  'História', 'Inglês', 'Português', 'Química', 'Sociologia', 'Projeto de Vida',
]

const V_SLOT = { m1: 'v1', m2: 'v2', m3: 'v3', m4: 'v4', m5: 'v5', m6: 'v6' }

async function main() {
  await client.connect()

  // 0. componente "Projeto de Ano Letivo - ADM" (não existe ainda)
  let projAdm = await client.query("select id from public.components where name = 'Projeto de Ano Letivo - ADM'")
  let projAdmId
  if (projAdm.rows.length === 0) {
    projAdmId = crypto.randomUUID()
    await client.query(
      `insert into public.components (id, name, category, color, weekly_hours, planning_hours) values ($1,$2,$3,$4,$5,$6)`,
      [projAdmId, 'Projeto de Ano Letivo - ADM', 'Projetos', '#0891b2', 16, 0],
    )
    console.log('componente criado: Projeto de Ano Letivo - ADM')
  } else {
    projAdmId = projAdm.rows[0].id
  }

  const compRows = await client.query('select id, name from public.components')
  const compIdByName = Object.fromEntries(compRows.rows.map((r) => [r.name, r.id]))
  const admId = compIdByName['Administração']
  const matId = compIdByName['Matemática']

  // 1. turmas
  const classIdByName = {}
  for (const newName of Object.values(CLASS_SWAP)) {
    const id = crypto.randomUUID()
    classIdByName[newName] = id
    await client.query('insert into public.classes (id, school_id, name, shift) values ($1,$2,$3,$4)', [
      id, SCHOOL_ID, newName, 'Matutino',
    ])
  }
  console.log('turmas criadas:', Object.keys(classIdByName).length)

  // 2. disciplinas de base comum + Projeto de Vida: 1 professor por disciplina, cobrindo as 6 turmas
  let baseInserted = 0
  for (const subject of BASE_SUBJECTS) {
    const compId = compIdByName[subject]
    const rows = await client.query(
      `select e.type, e.week, e.day, e.time_slot_id, cl.name as class_name
       from public.schedule_entries e
       join public.components comp on comp.id = e.component_id
       left join public.classes cl on cl.id = e.class_id
       where e.school_id = 'capsula' and comp.name = $1`,
      [subject],
    )
    const teacherId = crypto.randomUUID()
    await client.query(
      `insert into public.teachers (id, school_id, name, component_ids, contracted_hours_2026, is_orientador, orientador_target_hours)
       values ($1,$2,$3,$4,0,false,40)`,
      [teacherId, SCHOOL_ID, `Professor(a) de ${subject} (vaga em aberto)`, [compId]],
    )
    for (const r of rows.rows) {
      const newClassName = r.class_name ? CLASS_SWAP[r.class_name] : null
      const newClassId = newClassName ? classIdByName[newClassName] : null
      await client.query(
        `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
         values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
        [SCHOOL_ID, r.type, r.week, r.day, r.time_slot_id, newClassId, compId, teacherId],
      )
      baseInserted++
    }
  }
  console.log('disciplinas de base comum + PV: professores criados =', BASE_SUBJECTS.length, ', entradas =', baseInserted)

  // 3. FTP/Administração por ano (1º, 2º, 3º) - cobre as 2 turmas daquele ano (ADM1 e ADM2)
  const ftpSourceEntries = await client.query(
    `select e.type, e.week, e.day, e.time_slot_id, cl.name as class_name, comp.name as comp_name
     from public.schedule_entries e
     join public.components comp on comp.id = e.component_id
     join public.classes cl on cl.id = e.class_id
     where e.school_id = 'capsula' and e.type = 'aula'
       and comp.name in ('Inteligência Artificial','Multimídia','Projeto de Ano Letivo - IA','Projeto de Ano Letivo - MMD')`,
  )
  const COMPONENT_SWAP_FTP = {
    'Inteligência Artificial': 'Administração',
    'Multimídia': 'Administração',
    'Projeto de Ano Letivo - IA': 'Projeto de Ano Letivo - ADM',
    'Projeto de Ano Letivo - MMD': 'Projeto de Ano Letivo - ADM',
  }
  const YEAR_ROLE_DEFS = {
    1: { name: 'Professor(a) de FTP/Administração - 1º Ano (vaga em aberto)', isOrientador: false },
    2: { name: 'Professor(a) de FTP/Administração - 2º Ano (vaga em aberto)', isOrientador: true },
    3: { name: 'Professor(a) de FTP/Administração - 3º Ano (vaga em aberto)', isOrientador: false },
  }
  const yearTeacherId = {}
  for (const [year, def] of Object.entries(YEAR_ROLE_DEFS)) {
    const id = crypto.randomUUID()
    yearTeacherId[year] = id
    await client.query(
      `insert into public.teachers (id, school_id, name, component_ids, contracted_hours_2026, is_orientador, orientador_target_hours)
       values ($1,$2,$3,$4,0,$5,40)`,
      [id, SCHOOL_ID, def.name, [admId, projAdmId], def.isOrientador],
    )
  }
  let ftpInserted = 0
  for (const r of ftpSourceEntries.rows) {
    const year = r.class_name.match(/Turma (\d)/)[1]
    const teacherId = yearTeacherId[year]
    const newClassName = CLASS_SWAP[r.class_name]
    const newClassId = classIdByName[newClassName]
    const newCompId = compIdByName[COMPONENT_SWAP_FTP[r.comp_name]]
    await client.query(
      `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
       values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [SCHOOL_ID, r.type, r.week, r.day, r.time_slot_id, newClassId, newCompId, teacherId],
    )
    ftpInserted++
  }
  console.log('FTP/Administração por ano: professores criados = 3, entradas =', ftpInserted)

  // 4. Matemática: 1 única professora para as 6 turmas (aula mantém m-slots; planejamento vai para v-slots/vespertino)
  const mathSource = await client.query(
    `select e.type, e.week, e.day, e.time_slot_id, cl.name as class_name
     from public.schedule_entries e
     join public.components comp on comp.id = e.component_id
     left join public.classes cl on cl.id = e.class_id
     where e.school_id = 'capsula' and comp.name = 'Matemática'`,
  )
  const mathTeacherId = crypto.randomUUID()
  await client.query(
    `insert into public.teachers (id, school_id, name, component_ids, contracted_hours_2026, is_orientador, orientador_target_hours)
     values ($1,$2,$3,$4,0,false,40)`,
    [mathTeacherId, SCHOOL_ID, 'Professora de Matemática (vaga em aberto)', [matId]],
  )
  let mathInserted = 0
  for (const r of mathSource.rows) {
    const newClassName = r.class_name ? CLASS_SWAP[r.class_name] : null
    const newClassId = newClassName ? classIdByName[newClassName] : null
    const timeSlotId = r.type === 'planejamento' ? (V_SLOT[r.time_slot_id] ?? r.time_slot_id) : r.time_slot_id
    await client.query(
      `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
       values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [SCHOOL_ID, r.type, r.week, r.day, timeSlotId, newClassId, matId, mathTeacherId],
    )
    mathInserted++
  }
  console.log('Matemática: professora criada = 1, entradas =', mathInserted)

  const totalTeachers = await client.query("select count(*) from public.teachers where school_id='politecnico'")
  const totalEntries = await client.query("select count(*) from public.schedule_entries where school_id='politecnico'")
  console.log('TOTAL professores politécnico:', totalTeachers.rows[0].count)
  console.log('TOTAL schedule_entries politécnico:', totalEntries.rows[0].count)

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
