import { createClient } from '@supabase/supabase-js'
import AssignmentsMatrix from '@/components/admin/AssignmentsMatrix'
import { Info } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function AsignacionesPage() {
  // Consultas en paralelo para máxima velocidad
  const [modulosRes, serviciosRes, relacionesRes] = await Promise.all([
    supabase.from('modulos').select('*').eq('estado', 'activo').order('nombre_modulo'),
    supabase.from('servicios').select('*').order('nombre_servicio'),
    supabase.from('modulos_servicios').select('*')
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Asignación de Servicios</h2>
        <div className="flex items-center gap-2 mt-2 text-slate-400 text-sm bg-blue-900/10 p-3 rounded-lg border border-blue-900/30">
            <Info size={16} className="text-blue-400" />
            <p>Marque las casillas para indicar qué servicios puede atender cada módulo. Los cambios se guardan automáticamente.</p>
        </div>
      </div>

      <AssignmentsMatrix 
        modules={modulosRes.data || []} 
        services={serviciosRes.data || []} 
        assignments={relacionesRes.data || []} 
      />
    </div>
  )
}