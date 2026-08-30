// Importa backups/backup-grades-*.json para o Postgres do Supabase via `pg`
// (acesso direto de superusuário, dispensa a service role key) e concede
// school_access ao usuário indicado em todas as unidades presentes no backup.
//
// Uso:
//   PGHOST=... PGPASSWORD=... node scripts/migrate-backup-to-supabase.mjs \
//     backups/backup-grades-2026-08-30.json usuario@email.com
import { readFileSync } from 'node:fs'
import pg from 'pg'

const [, , backupPath, userEmail] = process.argv
if (!backupPath || !userEmail) {
  console.error('Uso: node scripts/migrate-backup-to-supabase.mjs <backup.json> <email>')
  process.exit(1)
}

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

const backup = JSON.parse(readFileSync(backupPath, 'utf-8'))

async function main() {
  await client.connect()

  console.log('Componentes:', backup.components.length)
  for (const c of backup.components) {
    await client.query(
      `insert into public.components (id, name, category, color, weekly_hours, planning_hours)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do update set name=excluded.name, category=excluded.category,
         color=excluded.color, weekly_hours=excluded.weekly_hours, planning_hours=excluded.planning_hours`,
      [c.id, c.name, c.category, c.color, c.weeklyHours, c.planningHours],
    )
  }

  console.log('Turmas:', backup.classes.length)
  for (const cl of backup.classes) {
    await client.query(
      `insert into public.classes (id, school_id, name, shift, year)
       values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
      [cl.id, cl.schoolId, cl.name, cl.shift, cl.year ?? null],
    )
  }

  console.log('Professores:', backup.teachers.length)
  for (const t of backup.teachers) {
    await client.query(
      `insert into public.teachers
         (id, school_id, name, email, phone, component_ids, contracted_hours_2026, is_orientador, orientador_target_hours)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
      [
        t.id,
        t.schoolId,
        t.name,
        t.email || null,
        t.phone || null,
        t.componentIds,
        t.contractedHours2026,
        t.isOrientador,
        t.orientadorTargetHours,
      ],
    )
  }

  console.log('Aulas/planejamento:', backup.schedule.length)
  for (const e of backup.schedule) {
    await client.query(
      `insert into public.schedule_entries
         (id, school_id, type, week, day, time_slot_id, class_id, component_id, teacher_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
      [
        e.id,
        e.schoolId,
        e.type,
        e.week,
        e.day,
        e.timeSlotId,
        e.classId ?? null,
        e.componentId ?? null,
        e.teacherId,
      ],
    )
  }

  // concede acesso a todas as unidades cadastradas (o usuário administra todas por enquanto)
  const schoolsRes = await client.query('select id from public.schools')
  const schoolIds = schoolsRes.rows.map((r) => r.id)
  const userRes = await client.query('select id from auth.users where email = $1', [userEmail])
  if (userRes.rows.length === 0) {
    console.warn(
      `Usuário ${userEmail} não encontrado em auth.users — crie a conta primeiro (Supabase Dashboard > Authentication) e rode de novo, ou conceda o acesso manualmente depois.`,
    )
  } else {
    const userId = userRes.rows[0].id
    for (const schoolId of schoolIds) {
      await client.query(
        `insert into public.school_access (user_id, school_id) values ($1,$2)
         on conflict do nothing`,
        [userId, schoolId],
      )
    }
    console.log(`school_access concedido para ${userEmail} em: ${schoolIds.join(', ')}`)
  }

  console.log('Migração concluída.')
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    console.error(err)
    await client.end()
    process.exit(1)
  })
