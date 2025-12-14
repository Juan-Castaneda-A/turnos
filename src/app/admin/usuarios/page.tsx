import { createClient } from '@supabase/supabase-js'
import UsersTable from '@/components/admin/UsersTable'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function UsuariosPage() {
  // Obtenemos usuarios y módulos en paralelo para que sea rápido
  const [usersRes, modulesRes] = await Promise.all([
    supabase.from('usuarios').select('*, modulos(nombre_modulo)').order('nombre_completo'),
    supabase.from('modulos').select('id_modulo, nombre_modulo').eq('estado', 'activo')
  ])

  return (
    <div className="space-y-6">
      <UsersTable 
        users={usersRes.data || []} 
        modules={modulesRes.data || []} 
      />
    </div>
  )
}