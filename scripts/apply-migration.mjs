// Aplica supabase/migrations/*.sql direto no Postgres via `pg`.
// Uso: DATABASE_URL="postgresql://..." node scripts/apply-migration.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations')

const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env
if (!PGHOST || !PGPASSWORD) {
  console.error('Defina PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE.')
  process.exit(1)
}

const client = new pg.Client({
  host: PGHOST,
  port: Number(PGPORT ?? 5432),
  user: PGUSER ?? 'postgres',
  password: PGPASSWORD,
  database: PGDATABASE ?? 'postgres',
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await client.connect()
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    console.log(`Aplicando ${file}...`)
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    await client.query(sql)
    console.log(`OK: ${file}`)
  }
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    console.error(err)
    await client.end()
    process.exit(1)
  })
