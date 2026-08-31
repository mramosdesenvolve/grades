// Backup completo do sistema (ponto de retorno) — todas as 4 unidades.
// O bloco "appData" usa o MESMO formato do botão "Backup JSON" do app
// (schools/teachers/classes/components/schedule em camelCase), então dá
// para restaurar tanto por este script quanto pela própria tela de
// Importar do app. Também salva school_access e a lista de usuários
// (id/e-mail, nunca senha) para referência.
import pg from 'pg'
import fs from 'node:fs'

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
  await client.connect()

  const schools = await client.query('select id, name from public.schools order by name')
  const components = await client.query(
    'select id, name, category, color, weekly_hours as "weeklyHours", planning_hours as "planningHours" from public.components order by name',
  )
  const teachers = await client.query(`
    select id, school_id as "schoolId", name, email, phone,
           component_ids as "componentIds",
           contracted_hours_2026 as "contractedHours2026",
           is_orientador as "isOrientador",
           orientador_target_hours as "orientadorTargetHours"
    from public.teachers order by school_id, name
  `)
  const classes = await client.query(
    'select id, school_id as "schoolId", name, shift, year from public.classes order by school_id, name',
  )
  const schedule = await client.query(`
    select id, school_id as "schoolId", type, week, day,
           time_slot_id as "timeSlotId", class_id as "classId",
           component_id as "componentId", teacher_id as "teacherId"
    from public.schedule_entries order by school_id, day, time_slot_id
  `)
  const schoolAccess = await client.query('select user_id as "userId", school_id as "schoolId" from public.school_access')
  const authUsers = await client.query('select id, email, created_at as "createdAt" from auth.users order by email')

  const backup = {
    generatedAt: new Date().toISOString(),
    counts: {
      schools: schools.rows.length,
      components: components.rows.length,
      teachers: teachers.rows.length,
      classes: classes.rows.length,
      schedule: schedule.rows.length,
      schoolAccess: schoolAccess.rows.length,
      authUsers: authUsers.rows.length,
    },
    appData: {
      schools: schools.rows,
      teachers: teachers.rows,
      classes: classes.rows,
      components: components.rows,
      schedule: schedule.rows,
    },
    schoolAccess: schoolAccess.rows,
    authUsers: authUsers.rows,
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const outPath = new URL(`../backups/full-backup-${dateStr}.json`, import.meta.url)
  fs.mkdirSync(new URL('../backups/', import.meta.url), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2))

  console.log('Backup salvo em:', outPath.pathname)
  console.log('Contagens:', backup.counts)

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end().catch(() => {})
  process.exit(1)
})
