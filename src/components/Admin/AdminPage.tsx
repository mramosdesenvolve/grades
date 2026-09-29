import { useState } from 'react'
import { Lock, ShieldCheck, Unlock } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export function AdminPage() {
  const { scheduleLocked, setScheduleLocked } = useApp()
  const [confirming, setConfirming] = useState(false)

  const handleToggle = () => {
    if (!scheduleLocked && !confirming) {
      setConfirming(true)
      return
    }
    setScheduleLocked(!scheduleLocked)
    setConfirming(false)
  }

  return (
    <div className="max-w-xl">
      <div className="mb-5 flex items-center gap-2">
        <ShieldCheck size={20} className="text-brand-600" />
        <h1 className="text-xl font-semibold text-slate-800">Administração</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Área restrita ao login administrador (Núcleo Pulsante / coordenação pedagógica geral).
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              scheduleLocked ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {scheduleLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {scheduleLocked ? 'Edição da grade bloqueada' : 'Edição da grade liberada'}
            </p>
            <p className="text-xs text-slate-500">
              {scheduleLocked
                ? 'Coordenadores de unidade só podem visualizar a grade. Apenas o admin pode editar.'
                : 'Coordenadores de unidade podem editar normalmente a grade da própria unidade.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          onBlur={() => setConfirming(false)}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${
            scheduleLocked
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : confirming
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-slate-800 hover:bg-slate-900'
          }`}
        >
          {scheduleLocked ? (
            <>
              <Unlock size={15} /> Desbloquear edição para todos
            </>
          ) : confirming ? (
            <>
              <Lock size={15} /> Confirmar bloqueio para todos
            </>
          ) : (
            <>
              <Lock size={15} /> Bloquear edição para todos
            </>
          )}
        </button>
        {!scheduleLocked && confirming && (
          <p className="mt-2 text-center text-xs text-slate-400">
            Ninguém além do admin conseguirá editar nenhuma grade até você desbloquear.
          </p>
        )}
      </div>
    </div>
  )
}
