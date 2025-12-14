import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PanelInterface from '@/components/funcionario/PanelInterface'

// Esta es una Server Page (por defecto en Next.js)
export default async function PanelPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('turnos_session')

  if (!sessionCookie) {
    redirect('/login')
  }

  // Parsear la sesión
  const user = JSON.parse(sessionCookie.value)

  // Renderizar el cliente pasándole el usuario
  return <PanelInterface user={user} />
}