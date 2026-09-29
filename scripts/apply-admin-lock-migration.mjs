import { readFileSync } from 'node:fs'
import pg from 'pg'

const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env
const client = new pg.Client({
  host: PGHOST ?? 'db.bywelytgxelvxdvjsqbd.supabase.co',
  port: Number(PGPORT ?? 5432),
  user: PGUSER ?? 'postgres',
  password: PGPASSWORD,
  database: PGDATABASE ?? 'postgres',
  ssl: { rejectUnauthorized: false },
})

const sql = readFileSync(new URL('../supabase/migrations/0002_admin_lock.sql', import.meta.url), 'utf8')

async function main() {
  await client.connect()
  await client.query('begin')
  await client.query(sql)
  await client.query('commit')
  console.log('migração aplicada com sucesso')
  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.query('rollback').catch(() => {})
  await client.end()
  process.exit(1)
})
