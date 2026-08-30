# Grades Escolares

App de montagem de grades de horário (React + TypeScript + Vite + Tailwind), com dados
persistidos no Supabase (Postgres + Auth) e controle de acesso por unidade escolar.

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # preencha com as credenciais do seu projeto Supabase
npm run dev
```

`.env.local` precisa de:

- `VITE_SUPABASE_URL` — Project URL (Settings → API no dashboard do Supabase).
- `VITE_SUPABASE_ANON_KEY` — chave anon/publishable (a mesma tela).

Essas duas são seguras para expor no cliente (é assim que o Supabase funciona — a segurança
real vem das políticas de Row Level Security no banco, não do sigilo dessas chaves).

## Banco de dados

Schema em `supabase/migrations/0001_init.sql`. Como esta máquina não tinha `psql` nem o
`supabase` CLI autenticado, o schema foi aplicado com um script Node (`pg`) usando a connection
string do Postgres diretamente:

```bash
PGHOST=... PGPORT=5432 PGUSER=postgres PGPASSWORD=... PGDATABASE=postgres \
  node scripts/apply-migration.mjs
```

A connection string (com a senha do banco) **nunca** deve ir para `.env.local`/variáveis
`VITE_*` (essas são embutidas no bundle do cliente) nem para o repositório — use só localmente,
na hora de rodar scripts administrativos.

### Conceder acesso a uma unidade

Usuários são criados no Supabase Dashboard (Authentication → Users → Add User). Depois, conceda
acesso a uma unidade inserindo uma linha em `school_access`:

```sql
insert into public.school_access (user_id, school_id)
values ('<uuid do usuário>', 'barra-da-tijuca');
```

`school_id` é um de: `capsula`, `barra-da-tijuca`, `niteroi`, `politecnico`.

### Importar um backup JSON existente

```bash
PGHOST=... PGPASSWORD=... node scripts/migrate-backup-to-supabase.mjs \
  backups/backup-grades-2026-08-30.json usuario@email.com
```

Isso faz upsert de componentes/turmas/professores/aulas do backup e concede `school_access` em
todas as unidades cadastradas para o e-mail informado.

## Deploy (Vercel)

1. Conecte o repositório no Vercel (framework preset "Vite" é detectado automaticamente).
2. Em Project Settings → Environment Variables, adicione `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` com os mesmos valores do `.env.local`.
3. Deploy. Cada push na branch principal gera um novo deploy automaticamente.
