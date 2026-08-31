// Cria 1 login por unidade (e-mail sintético interno, nunca visto pelo
// usuário — o app traduz o "nome da unidade" digitado no login para esse
// e-mail) com acesso restrito SOMENTE à própria escola.
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

const PASSWORD = 'grades2027'
const UNITS = [
  { schoolId: 'capsula', email: 'capsula@unidade.login' },
  { schoolId: 'barra-da-tijuca', email: 'barra-da-tijuca@unidade.login' },
  { schoolId: 'niteroi', email: 'niteroi@unidade.login' },
  { schoolId: 'politecnico', email: 'politecnico@unidade.login' },
]

async function main() {
  await client.connect()
  await client.query('create extension if not exists pgcrypto')

  for (const { schoolId, email } of UNITS) {
    const existing = await client.query('select id from auth.users where email = $1', [email])
    let userId
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id
      await client.query('update auth.users set encrypted_password = crypt($2, gen_salt($3)) where id = $1', [userId, PASSWORD, 'bf'])
      console.log(schoolId, '-> usuário já existia, senha atualizada:', userId)
    } else {
      const res = await client.query(
        `insert into auth.users (
           instance_id, id, aud, role, email, encrypted_password,
           email_confirmed_at, last_sign_in_at,
           raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
           confirmation_token, email_change, email_change_token_new, recovery_token
         ) values (
           '00000000-0000-0000-0000-000000000000',
           gen_random_uuid(), 'authenticated', 'authenticated', $1, crypt($2, gen_salt('bf')),
           now(), now(),
           '{"provider":"email","providers":["email"]}', '{}', now(), now(),
           '', '', '', ''
         ) returning id`,
        [email, PASSWORD],
      )
      userId = res.rows[0].id
      console.log(schoolId, '-> usuário criado:', userId)
    }

    const identity = await client.query('select id from auth.identities where user_id = $1', [userId])
    if (identity.rows.length === 0) {
      await client.query(
        `insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
         values (gen_random_uuid(), $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', $1::text, now(), now(), now())`,
        [userId, email],
      )
    }

    // acesso SOMENTE à própria unidade (remove qualquer acesso a outras, se existir)
    await client.query('delete from public.school_access where user_id = $1 and school_id <> $2', [userId, schoolId])
    await client.query(
      'insert into public.school_access (user_id, school_id) values ($1, $2) on conflict do nothing',
      [userId, schoolId],
    )
    console.log(schoolId, '-> acesso restrito confirmado.')
  }

  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
