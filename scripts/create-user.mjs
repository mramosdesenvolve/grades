// Cria um usuário direto em auth.users (bootstrap inicial, sem UI de cadastro).
// Uso: PGHOST=... PGPASSWORD=... node scripts/create-user.mjs email senha
import pg from 'pg'

const [, , email, password] = process.argv
if (!email || !password) {
  console.error('Uso: node scripts/create-user.mjs <email> <senha>')
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
  await client.connect()
  await client.query('create extension if not exists pgcrypto')

  const existing = await client.query('select id from auth.users where email = $1', [email])
  let userId
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id
    console.log('Usuário já existe:', userId)
    await client.query('update auth.users set encrypted_password = crypt($2, gen_salt($3)) where id = $1', [
      userId,
      password,
      'bf',
    ])
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
      [email, password],
    )
    userId = res.rows[0].id
    console.log('Usuário criado:', userId)
  }

  const identity = await client.query('select id from auth.identities where user_id = $1', [userId])
  if (identity.rows.length === 0) {
    await client.query(
      `insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
       values (gen_random_uuid(), $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', $1::text, now(), now(), now())`,
      [userId, email],
    )
    console.log('Identity criada.')
  }
  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
