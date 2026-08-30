// Constrói a grade de Cápsula como espelho de Niterói, invertendo as trilhas
// IA <-> MMD (o Orientador em Cápsula é da trilha IA, não MMD).
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

const SCHOOL_ID = 'capsula'

// nome do professor em Niterói -> chave de papel
const ROLE_BY_NITEROI_NAME = {
  'Karina Costa Cardoso': 'EdFisica',
  'Joana Martins de Vasconcelos': 'Artes',
  'Esther de Mello Luciano': 'Sociologia',
  'Raffaela Araujo D Angelo': 'Biologia',
  'Fernando Pereira da Rocha Azevedo': 'FTP_IA_unified',
  'Professor(a) de FTP/LET - MMD - Turmas 1MMD e 2MMD (vaga em aberto)': 'FTP_MMD_regular',
  'Vanessa da Silva Fernandes Doria Costa': 'FTP_MMD_orientador',
  'Giuliana Ribeira Pacini Pena': 'PV_IA',
  'Lane Lopes de Souza': 'PV_MMD',
  'Gabriella Caruncho de Brito Botelho': 'Mat_IA',
  'Professor(a) de Matemática - Turmas MMD (vaga em aberto)': 'Mat_MMD',
  'Andre Lourenco da Silveira': 'Quimica',
  'Andre Luiz Reynaud Sampaio': 'Historia',
  'Moira do Nascimento Souza': 'Portugues',
  'Joao Paulo Goncalves Vianna': 'Fisica',
  'Gabriel da Costa Novaes Cunha': 'Geografia',
  'Flavia Barja Duarte': 'Filosofia',
  'Joana Soares Gomes': 'Ingles',
}

// papel em Niterói -> papel em Cápsula (troca IA <-> MMD; resto igual)
const ROLE_SWAP = {
  EdFisica: 'EdFisica',
  Artes: 'Artes',
  Sociologia: 'Sociologia',
  Biologia: 'Biologia',
  Quimica: 'Quimica',
  Historia: 'Historia',
  Portugues: 'Portugues',
  Fisica: 'Fisica',
  Geografia: 'Geografia',
  Filosofia: 'Filosofia',
  Ingles: 'Ingles',
  FTP_IA_unified: 'FTP_MMD_unified',
  FTP_MMD_regular: 'FTP_IA_regular',
  FTP_MMD_orientador: 'FTP_IA_orientador',
  PV_IA: 'PV_MMD',
  PV_MMD: 'PV_IA',
  Mat_IA: 'Mat_MMD',
  Mat_MMD: 'Mat_IA',
}

// papel em Cápsula -> {nome, componentes, isOrientador}
const CAPSULA_ROLE_DEFS = {
  EdFisica: ['Professor(a) de Educação Física (vaga em aberto)', ['Educação Física'], false],
  Artes: ['Professor(a) de Artes (vaga em aberto)', ['Artes'], false],
  Sociologia: ['Professor(a) de Sociologia (vaga em aberto)', ['Sociologia'], false],
  Biologia: ['Professor(a) de Biologia (vaga em aberto)', ['Biologia'], false],
  Quimica: ['Professor(a) de Química (vaga em aberto)', ['Química'], false],
  Historia: ['Professor(a) de História (vaga em aberto)', ['História'], false],
  Portugues: ['Professor(a) de Português (vaga em aberto)', ['Português'], false],
  Fisica: ['Professor(a) de Física (vaga em aberto)', ['Física'], false],
  Geografia: ['Professor(a) de Geografia (vaga em aberto)', ['Geografia'], false],
  Filosofia: ['Professor(a) de Filosofia (vaga em aberto)', ['Filosofia'], false],
  Ingles: ['Professor(a) de Inglês (vaga em aberto)', ['Inglês'], false],
  FTP_MMD_unified: [
    'Professor(a) de FTP/LET - MMD (vaga em aberto)',
    ['Multimídia', 'Projeto de Ano Letivo - MMD'],
    false,
  ],
  FTP_IA_regular: [
    'Professor(a) de FTP/LET - IA - Turmas 1IA e 2IA (vaga em aberto)',
    ['Inteligência Artificial', 'Projeto de Ano Letivo - IA'],
    false,
  ],
  FTP_IA_orientador: [
    'Professor(a) Orientador(a) - Turma 3IA (vaga em aberto)',
    ['Inteligência Artificial', 'Projeto de Ano Letivo - IA'],
    true,
  ],
  PV_IA: ['Professor(a) de Projeto de Vida - IA (vaga em aberto)', ['Projeto de Vida'], false],
  PV_MMD: ['Professor(a) de Projeto de Vida - MMD (vaga em aberto)', ['Projeto de Vida'], false],
  Mat_IA: ['Professor(a) de Matemática - Turmas IA (vaga em aberto)', ['Matemática'], false],
  Mat_MMD: ['Professor(a) de Matemática - Turmas MMD (vaga em aberto)', ['Matemática'], false],
}

const COMPONENT_SWAP = {
  'Inteligência Artificial': 'Multimídia',
  Multimídia: 'Inteligência Artificial',
  'Projeto de Ano Letivo - IA': 'Projeto de Ano Letivo - MMD',
  'Projeto de Ano Letivo - MMD': 'Projeto de Ano Letivo - IA',
}

const CLASS_SWAP = {
  'Turma 1IA': 'Turma 1MMD',
  'Turma 1MMD': 'Turma 1IA',
  'Turma 2IA': 'Turma 2MMD',
  'Turma 2MMD': 'Turma 2IA',
  'Turma 3IA': 'Turma 3MMD',
  'Turma 3MMD': 'Turma 3IA',
}

async function main() {
  await client.connect()

  // 1. turmas de Cápsula (mesmos 6 nomes/turnos que Niterói)
  const niteroiClasses = await client.query(
    "select id, name, shift from public.classes where school_id = 'niteroi'",
  )
  const capsulaClassIdByName = {}
  for (const c of niteroiClasses.rows) {
    const id = crypto.randomUUID()
    capsulaClassIdByName[c.name] = id
    await client.query('insert into public.classes (id, school_id, name, shift) values ($1,$2,$3,$4)', [
      id,
      SCHOOL_ID,
      c.name,
      c.shift,
    ])
  }
  console.log('turmas criadas:', niteroiClasses.rows.length)

  // 2. professores (vagas) de Cápsula
  const compRows = await client.query('select id, name from public.components')
  const compIdByName = Object.fromEntries(compRows.rows.map((r) => [r.name, r.id]))

  const capsulaTeacherIdByRole = {}
  for (const [role, [name, compNames, isOrientador]] of Object.entries(CAPSULA_ROLE_DEFS)) {
    const id = crypto.randomUUID()
    capsulaTeacherIdByRole[role] = id
    const compIds = compNames.map((n) => compIdByName[n])
    await client.query(
      `insert into public.teachers (id, school_id, name, component_ids, contracted_hours_2026, is_orientador, orientador_target_hours)
       values ($1,$2,$3,$4,0,$5,40)`,
      [id, SCHOOL_ID, name, compIds, isOrientador],
    )
  }
  console.log('professores (vagas) criados:', Object.keys(CAPSULA_ROLE_DEFS).length)

  // 3. schedule_entries de Niterói -> transformadas para Cápsula
  const niteroiEntries = await client.query(
    `select e.type, e.week, e.day, e.time_slot_id, cl.name as class_name, comp.name as comp_name, t.name as teacher_name
     from public.schedule_entries e
     left join public.classes cl on cl.id = e.class_id
     left join public.teachers t on t.id = e.teacher_id
     left join public.components comp on comp.id = e.component_id
     where e.school_id = 'niteroi'`,
  )

  let inserted = 0
  const unmappedRoles = new Set()
  for (const e of niteroiEntries.rows) {
    const niteroiRole = ROLE_BY_NITEROI_NAME[e.teacher_name]
    if (!niteroiRole) {
      unmappedRoles.add(e.teacher_name)
      continue
    }
    const capsulaRole = ROLE_SWAP[niteroiRole]
    const capsulaTeacherId = capsulaTeacherIdByRole[capsulaRole]

    const capsulaClassName = e.class_name ? (CLASS_SWAP[e.class_name] ?? e.class_name) : null
    const capsulaClassId = capsulaClassName ? capsulaClassIdByName[capsulaClassName] : null

    const capsulaCompName = e.comp_name ? (COMPONENT_SWAP[e.comp_name] ?? e.comp_name) : null
    const capsulaCompId = capsulaCompName ? compIdByName[capsulaCompName] : null

    await client.query(
      `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
       values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [SCHOOL_ID, e.type, e.week, e.day, e.time_slot_id, capsulaClassId, capsulaCompId, capsulaTeacherId],
    )
    inserted++
  }

  console.log('schedule_entries inseridas:', inserted)
  if (unmappedRoles.size > 0) console.log('professores sem papel mapeado:', Array.from(unmappedRoles))

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
