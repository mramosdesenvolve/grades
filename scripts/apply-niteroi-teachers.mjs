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

// id atual (placeholder) -> nome real
const RENAMES = {
  '64f64768-d946-46ae-9fd2-fa5245d7d2d0': 'Joana Martins de Vasconcelos', // Artes
  '2f7f4c80-e4eb-4dac-bc92-c12c71ce71f4': 'Raffaela Araujo D Angelo', // Biologia
  '97d7ca2e-7694-409a-8ba5-c8b9941a96c9': 'Karina Costa Cardoso', // Ed. Física
  'c5b3fb16-0dfe-42d6-8a7a-326bc4027942': 'Flavia Barja Duarte', // Filosofia
  '334027a0-c620-4d92-b613-0f924a5f8e89': 'Joao Paulo Goncalves Vianna', // Física
  '4d00fcd2-993a-4771-be36-f38bbdf6ebdf': 'Fernando Pereira da Rocha Azevedo', // FTP/LET IA
  'aa4c5b98-06d9-4db0-a3ee-96beb3a55566': 'Gabriel da Costa Novaes Cunha', // Geografia
  '420e73b3-0068-4a82-a36b-3e7df93ee750': 'Andre Luiz Reynaud Sampaio', // História
  'ce88b0c3-6810-4a04-9c83-74ee68662709': 'Joana Soares Gomes', // Inglês
  '200e4f28-f6d2-49db-9d5d-f09284dbc680': 'Moira do Nascimento Souza', // Português
  'dc207afd-24ab-41e3-bfae-531d2208ce2d': 'Giuliana Ribeira Pacini Pena', // PV-IA
  '94916c66-6e33-4b22-9a37-c96634d0a72d': 'Lane Lopes de Souza', // PV-MMD
  '0ab6272b-1865-4693-8ad5-9df0c72b975b': 'Andre Lourenco da Silveira', // Química
  '3e3d53a9-05ca-4e66-b5d5-8b63be46727c': 'Esther de Mello Luciano', // Sociologia
}

// mesclagens: manter o primeiro id (renomeado), mover aulas do segundo id para o primeiro, apagar o segundo
const MERGES = [
  {
    keep: 'd5de5178-3f70-46f3-8669-16b8ae229888', // Matemática - Turmas IA
    drop: 'd83a0619-39f4-469d-952c-1f89dc67d3da', // Matemática - Turmas MMD
    name: 'Gabriella Caruncho de Brito Botelho',
  },
  {
    keep: '92b126cf-4329-4fdf-b34d-80c7fb7093ef', // FTP/LET - MMD
    drop: '20a3445b-a1fe-4850-a694-30443f47c598', // Orientador Turma 3MMD
    name: 'Vanessa da Silva Fernandes Doria Costa',
  },
]

async function main() {
  await client.connect()

  for (const [id, name] of Object.entries(RENAMES)) {
    await client.query('update public.teachers set name = $1 where id = $2', [name, id])
  }
  console.log('renomeados:', Object.keys(RENAMES).length)

  for (const m of MERGES) {
    await client.query('update public.teachers set name = $1 where id = $2', [m.name, m.keep])
    const r = await client.query(
      'update public.schedule_entries set teacher_id = $1 where teacher_id = $2',
      [m.keep, m.drop],
    )
    await client.query('delete from public.teachers where id = $1', [m.drop])
    console.log(`merge ${m.name}: ${r.rowCount} aulas movidas, vaga duplicada removida`)
  }

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
