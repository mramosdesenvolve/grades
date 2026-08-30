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

// Barra (nome) -> Niterói (nome), por papel/componente
const MAP = {
  'Alexandre Ribeiro Freitas': 'Gabriella Caruncho de Brito Botelho',
  'Carlos de Lima Serafim': 'Giuliana Ribeira Pacini Pena',
  'Deivid Francis de Souza Britto': 'Andre Luiz Reynaud Sampaio',
  'Fabio Bernardo da Silva': 'Fernando Pereira da Rocha Azevedo',
  'Gabriel Pereira Frota': 'Raffaela Araujo D Angelo',
  'Gustavo Pereira': 'Flavia Barja Duarte',
  'Hyago Sarraf': 'Esther de Mello Luciano',
  'Jonas Rodrigues da Silva Leandro': 'Moira do Nascimento Souza',
  'Larissa Figueiredo Belém': 'Vanessa da Silva Fernandes Doria Costa',
  'Layane Souza Marques': 'Lane Lopes de Souza',
  'Lucas Montes Werneck de Freitas': 'Karina Costa Cardoso',
  'Luiz Felipe Santoro Dantas': 'Andre Lourenco da Silveira',
  'Nívea Bandeira Xavier': 'Joana Martins de Vasconcelos',
  'Patryck Mendes de Lima Alvarento': 'Joao Paulo Goncalves Vianna',
  'Professor(a) de Matemática - Turmas MMD (vaga em aberto)':
    'Professor(a) de Matemática - Turmas MMD (vaga em aberto)',
  'Professor(a) de Multimídia/LET-MMD - Turmas 1MMD e 2MMD (vaga em aberto)':
    'Professor(a) de FTP/LET - MMD - Turmas 1MMD e 2MMD (vaga em aberto)',
  'Raquel Martinez del Porto Silva': 'Joana Soares Gomes',
  'Verônica Rodrigues Azevedo Almeida': 'Gabriel da Costa Novaes Cunha',
}

async function main() {
  await client.connect()

  const barraEntries = await client.query(
    `select t.name as teacher_name, e.component_id, e.day, e.time_slot_id, e.week
     from public.schedule_entries e
     join public.teachers t on t.id = e.teacher_id
     where e.school_id = 'barra-da-tijuca' and e.type = 'planejamento'`,
  )

  const niteroiTeachers = await client.query(
    "select id, name from public.teachers where school_id = 'niteroi'",
  )
  const niteroiIdByName = Object.fromEntries(niteroiTeachers.rows.map((r) => [r.name, r.id]))

  let inserted = 0
  const missing = new Set()
  for (const e of barraEntries.rows) {
    const niteroiName = MAP[e.teacher_name]
    const niteroiId = niteroiName ? niteroiIdByName[niteroiName] : null
    if (!niteroiId) {
      missing.add(e.teacher_name)
      continue
    }
    await client.query(
      `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, component_id, teacher_id)
       values (gen_random_uuid(), 'niteroi', 'planejamento', $1, $2, $3, $4, $5)`,
      [e.week, e.day, e.time_slot_id, e.component_id, niteroiId],
    )
    inserted++
  }

  console.log('inseridos:', inserted)
  if (missing.size > 0) console.log('sem mapeamento:', Array.from(missing))

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
