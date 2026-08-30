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

// nome atual do placeholder (como veio de migrate-capsula.mjs) -> nome real + CH
const RENAMES = {
  'Professor(a) de Sociologia (vaga em aberto)': ['Andre William de Novais da Costa', 20],
  'Professor(a) de FTP/LET - MMD (vaga em aberto)': ['Antonio Cesar Azadinho da Silva', 30],
  'Professor(a) de Biologia (vaga em aberto)': ['Bruna Faria Simões', 12],
  'Professor(a) de Física (vaga em aberto)': ['Carlos Vinicius Barros Gomes', 14],
  'Professor(a) de Artes (vaga em aberto)': ['Dayane Medeiros Ferreira', 12],
  'Professor(a) de Filosofia (vaga em aberto)': ['Gabriel Telles dos Santos', 18],
  'Professor(a) de Geografia (vaga em aberto)': ['Hellen Gomes da Silva Araújo', 12],
  'Professor(a) de Português (vaga em aberto)': ['Larissa Carvalho da Silva Porto', 23],
  'Professor(a) de História (vaga em aberto)': ['Marcellus Zampier', 14],
  'Professor(a) de Química (vaga em aberto)': ['Renan Victor Rocha Neves', 14],
  'Professor(a) de Educação Física (vaga em aberto)': ['Taffarel Silva dos Santos', 12],
  'Professor(a) de Inglês (vaga em aberto)': ['Yasmin El Hage Gomes da Silva', 14],
}

// merges: mantém o primeiro (renomeado), move aulas do segundo para o primeiro, apaga o segundo
const MERGES = [
  {
    keep: 'Professor(a) de FTP/LET - IA - Turmas 1IA e 2IA (vaga em aberto)',
    drop: 'Professor(a) Orientador(a) - Turma 3IA (vaga em aberto)',
    name: 'Andre Ferreira Zeferino',
    ch: 40,
    isOrientador: true,
  },
  {
    keep: 'Professor(a) de Projeto de Vida - IA (vaga em aberto)',
    drop: 'Professor(a) de Projeto de Vida - MMD (vaga em aberto)',
    name: 'Gabriela Campos e Silva',
    ch: 6,
    isOrientador: false,
  },
  {
    keep: 'Professor(a) de Matemática - Turmas IA (vaga em aberto)',
    drop: 'Professor(a) de Matemática - Turmas MMD (vaga em aberto)',
    name: 'Victor Correia Nunes da Silva',
    ch: 24,
    isOrientador: false,
  },
]

async function main() {
  await client.connect()

  for (const [placeholder, [name, ch]] of Object.entries(RENAMES)) {
    const r = await client.query(
      "update public.teachers set name = $1, contracted_hours_2026 = $2 where school_id = 'capsula' and name = $3",
      [name, ch, placeholder],
    )
    if (r.rowCount !== 1) console.log('AVISO renomear:', placeholder, r.rowCount)
  }
  console.log('renomeados diretos:', Object.keys(RENAMES).length)

  for (const m of MERGES) {
    const keepRow = await client.query(
      "select id from public.teachers where school_id = 'capsula' and name = $1",
      [m.keep],
    )
    const dropRow = await client.query(
      "select id from public.teachers where school_id = 'capsula' and name = $1",
      [m.drop],
    )
    if (keepRow.rows.length !== 1 || dropRow.rows.length !== 1) {
      console.log('AVISO merge não encontrado:', m.keep, m.drop)
      continue
    }
    const keepId = keepRow.rows[0].id
    const dropId = dropRow.rows[0].id
    await client.query(
      'update public.teachers set name = $1, contracted_hours_2026 = $2, is_orientador = $3, orientador_target_hours = 40 where id = $4',
      [m.name, m.ch, m.isOrientador, keepId],
    )
    const moved = await client.query(
      'update public.schedule_entries set teacher_id = $1 where teacher_id = $2',
      [keepId, dropId],
    )
    await client.query('delete from public.teachers where id = $1', [dropId])
    console.log(`merge ${m.name}: ${moved.rowCount} entradas movidas, duplicata removida`)
  }

  const total = await client.query("select count(*) from public.teachers where school_id='capsula'")
  console.log('total professores capsula:', total.rows[0].count)

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
