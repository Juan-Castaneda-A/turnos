'use client'

import { logoutAction } from '@/actions/auth'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await logoutAction()
    router.push('/login') // Redirige forzosamente al cliente
  }

  return (
    <button 
      onClick={handleLogout}
      className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
    >
      <LogOut size={18} />
      Cerrar Sesión
    </button>
  )
}