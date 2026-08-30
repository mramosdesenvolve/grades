// Insere o payload de Niterói (turmas, professores-placeholder, aulas) no Postgres.
import { readFileSync } from 'node:fs'
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

const payload = JSON.parse(readFileSync('/tmp/niteroi_payload.json', 'utf-8'))

async function main() {
  await client.connect()

  for (const cl of payload.classes) {
    await client.query(
      `insert into public.classes (id, school_id, name, shift) values ($1,$2,$3,$4)`,
      [cl.id, cl.schoolId, cl.name, cl.shift],
    )
  }
  console.log('classes:', payload.classes.length)

  for (const t of payload.teachers) {
    const componentIds = t.componentNames
      .map((n) => null) // resolved already in python step via componentId directly in schedule; teachers just need ids from name lookup here
    // resolve componentIds by name against DB
    const res = await client.query('select id from public.components where name = any($1)', [
      t.componentNames,
    ])
    const ids = res.rows.map((r) => r.id)
    await client.query(
      `insert into public.teachers (id, school_id, name, component_ids, contracted_hours_2026, is_orientador, orientador_target_hours)
       values ($1,$2,$3,$4,0,false,40)`,
      [t.id, t.schoolId, t.name, ids],
    )
  }
  console.log('teachers:', payload.teachers.length)

  for (const e of payload.schedule) {
    await client.query(
      `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [e.id, e.schoolId, e.type, e.week, e.day, e.timeSlotId, e.classId, e.componentId, e.teacherId],
    )
  }
  console.log('schedule:', payload.schedule.length)

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
