import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import logoEtim from '../../assets/logo-etim-senac-branco.svg'

// unidades com login pelo nome (sem e-mail) — o app traduz para o e-mail
// sintético interno correspondente antes de autenticar
const UNIT_IDS = ['capsula', 'barra-da-tijuca', 'niteroi', 'politecnico', 'piedade']

// login administrador (núcleo pulsante / coordenação pedagógica geral) — vê e
// edita todas as unidades e controla o bloqueio global da grade
const ADMIN_IDS = ['nucleo-pulsante']

function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
}

function resolveLoginIdentifier(input: string): string {
  const trimmed = input.trim()
  if (trimmed.includes('@')) return trimmed // e-mail normal (ex: administrador)
  const normalized = normalize(trimmed)
  if (UNIT_IDS.includes(normalized)) return `${normalized}@unidade.login`
  if (ADMIN_IDS.includes(normalized)) return `${normalized}@administrador.login`
  return trimmed
}

export function LoginPage() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: signInError } = await signIn(resolveLoginIdentifier(username), password)
    setLoading(false)
    if (signInError) setError('Unidade/e-mail ou senha inválidos.')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-brand-600 px-4">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-7 shadow-xl">
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-brand-600 px-4 py-3">
          <img src={logoEtim} alt="ETIM Senac RJ" className="h-12 w-auto shrink-0" />
          <div>
            <p className="text-sm font-bold leading-tight text-white">Grades</p>
            <p className="text-xs leading-tight text-brand-200">Escolares</p>
          </div>
        </div>

        <h1 className="mb-4 text-lg font-semibold text-slate-800">Entrar</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Unidade</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: capsula, barra-da-tijuca, niteroi, politecnico"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-senac-laranja px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            <LogIn size={16} /> {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Acesso por convite. Fale com o administrador se precisar de uma conta.
        </p>
      </div>
      <p className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-brand-200">
        Desenvolvimento Marcos Ramos
      </p>
    </div>
  )
}
