import { createClient } from '@supabase/supabase-js'
import HistoryTable from '@/components/admin/HistoryTable'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function HistorialPage() {
  // Cargamos la lista de servicios para el filtro (Server-side)
  const { data: services } = await supabase
    .from('servicios')
    .select('id_servicio, nombre_servicio')
    .order('nombre_servicio')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Historial de Turnos</h2>
        <p className="text-slate-400 mt-1">Auditoría completa de operaciones.</p>
      </div>
      
      <HistoryTable services={services || []} />
    </div>
  )
}