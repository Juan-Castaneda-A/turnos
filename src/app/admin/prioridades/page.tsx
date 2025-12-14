import { createClient } from '@supabase/supabase-js'
import PriorityManager from '@/components/admin/PriorityManager'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function PrioridadesPage() {
  // 1. Obtener Módulos Activos
  const { data: modules } = await supabase
    .from('modulos')
    .select('id_modulo, nombre_modulo')
    .eq('estado', 'activo')
    .order('nombre_modulo')

  // 2. Obtener la tabla intermedia con el nombre del servicio
  // Hacemos un join para traer el nombre_servicio
  const { data: assignments } = await supabase
    .from('modulos_servicios')
    .select(`
        id,
        id_modulo,
        id_servicio,
        prioridad,
        servicios ( nombre_servicio )
    `)
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Configuración de Prioridades</h2>
        <p className="text-slate-400 mt-1">Defina el orden de atención de servicios por cada módulo.</p>
      </div>
      
      <PriorityManager 
        modules={modules || []} 
        assignments={assignments || []} 
      />
    </div>
  )
}