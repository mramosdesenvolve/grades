import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginPage } from './components/Auth/LoginPage'
import { Sidebar, type Page } from './components/Layout/Sidebar'
import { SchedulePage } from './components/Schedule/SchedulePage'
import { AllUnitsComponentPage } from './components/Schedule/AllUnitsComponentPage'
import { TeachersPage } from './components/Teachers/TeachersPage'
import { ClassesPage } from './components/Classes/ClassesPage'
import { ComponentsPage } from './components/Components/ComponentsPage'

function AppContent() {
  const [page, setPage] = useState<Page>('schedule')
  const { loading, accessibleSchoolIds } = useApp()
  const { signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Carregando...
      </div>
    )
  }

  if (accessibleSchoolIds.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-slate-700">
          Sua conta ainda não tem acesso a nenhuma unidade.
        </p>
        <p className="text-xs text-slate-400">Fale com o administrador para liberar o acesso.</p>
        <button
          onClick={() => signOut()}
          className="mt-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Sair
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar page={page} setPage={setPage} />
      <main className="flex-1 overflow-x-hidden p-6 print:p-0">
        {page === 'schedule' && <SchedulePage />}
        {page === 'teachers' && <TeachersPage />}
        {page === 'classes' && <ClassesPage />}
        {page === 'components' && <ComponentsPage />}
        {page === 'allRegencia' && <AllUnitsComponentPage entryType="aula" />}
        {page === 'allPlanejamento' && <AllUnitsComponentPage entryType="planejamento" />}
      </main>
    </div>
  )
}

function AuthGate() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!session) return <LoginPage />

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}
