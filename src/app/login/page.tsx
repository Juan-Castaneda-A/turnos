'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginAction } from '@/actions/auth'
import { Loader2, KeyRound, User } from 'lucide-react'
import { Toaster, toast } from 'sonner' // Notificaciones bonitas

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await loginAction(formData)

    if (result.success) {
      toast.success(`Bienvenido, ${result.user.nombre_completo}`)
      // Redirigir según el rol
      if (result.user.rol === 'administrador') {
        router.push('/admin/dashboard')
      } else {
        router.push('/funcionario/panel')
      }
    } else {
      toast.error(result.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Toaster position="top-center" richColors />
      
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-slate-900 p-8 border border-slate-800 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-900/30 text-blue-500 mb-4">
            <KeyRound size={32} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Iniciar Sesión</h2>
          <p className="mt-2 text-sm text-slate-400">Sistema de Turnos Notaría 3ra</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300">Usuario</label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User size={18} />
                </div>
                <input
                  name="username"
                  type="text"
                  required
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800 p-3 pl-10 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="juan.perez"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300">Contraseña</label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <KeyRound size={18} />
                </div>
                <input
                  name="password"
                  type="password"
                  required
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800 p-3 pl-10 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}