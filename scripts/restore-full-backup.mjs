// Restaura um backup gerado por full-backup.mjs — APAGA e recarrega
// schools/components/teachers/classes/schedule_entries/school_access por
// completo a partir do arquivo indicado. Não mexe em auth.users (login das
// unidades continua igual).
//
// Uso: PGHOST=... PGPASSWORD=... node scripts/restore-full-backup.mjs backups/full-backup-2026-08-31.json
import pg from 'pg'
import fs from 'node:fs'

const [, , filePath] = process.argv
if (!filePath) {
  console.error('Uso: node scripts/restore-full-backup.mjs <caminho-do-backup.json>')
  process.exit(1)
}

const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env
const client = new pg.Client({
  host: PGHOST,
  port: Number(PGPORT ?? 5432),
  user: PGUSER ?? 'postgres',
  password: PGPASSWORD,
  database: PGDATABASE ?? 'postgres',
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const backup = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const { schools, teachers, classes, components, schedule } = backup.appData
  const schoolAccess = backup.schoolAccess ?? []

  console.log('Restaurando backup de', backup.generatedAt)
  console.log('Contagens no arquivo:', backup.counts)

  await client.connect()
  await client.query('begin')
  try {
    // ordem: filhos antes dos pais (FKs)
    await client.query('delete from public.schedule_entries')
    await client.query('delete from public.school_access')
    await client.query('delete from public.classes')
    await client.query('delete from public.teachers')
    await client.query('delete from public.components')
    await client.query('delete from public.schools')

    for (const s of schools) {
      await client.query('insert into public.schools (id, name) values ($1, $2)', [s.id, s.name])
    }
    for (const c of components) {
      await client.query(
        'insert into public.components (id, name, category, color, weekly_hours, planning_hours) values ($1,$2,$3,$4,$5,$6)',
        [c.id, c.name, c.category, c.color, c.weeklyHours, c.planningHours],
      )
    }
    for (const t of teachers) {
      await client.query(
        `insert into public.teachers (id, school_id, name, email, phone, component_ids, contracted_hours_2026, is_orientador, orientador_target_hours)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [t.id, t.schoolId, t.name, t.email ?? null, t.phone ?? null, t.componentIds, t.contractedHours2026, t.isOrientador, t.orientadorTargetHours],
      )
    }
    for (const c of classes) {
      await client.query('insert into public.classes (id, school_id, name, shift, year) values ($1,$2,$3,$4,$5)', [
        c.id, c.schoolId, c.name, c.shift, c.year ?? null,
      ])
    }
    for (const e of schedule) {
      await client.query(
        `insert into public.schedule_entries (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [e.id, e.schoolId, e.type, e.week, e.day, e.timeSlotId, e.classId ?? null, e.componentId ?? null, e.teacherId],
      )
    }
    for (const a of schoolAccess) {
      await client.query('insert into public.school_access (user_id, school_id) values ($1, $2) on conflict do nothing', [
        a.userId, a.schoolId,
      ])
    }

    await client.query('commit')
    console.log('Restauração concluída com sucesso.')
  } catch (err) {
    await client.query('rollback')
    throw err
  }

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end().catch(() => {})
  process.exit(1)
})
