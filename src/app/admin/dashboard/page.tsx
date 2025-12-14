// src/app/admin/page.tsx
import { createClient } from '@supabase/supabase-js'
import { Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

// Cliente Supabase (Server-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Esta función se ejecuta en el servidor antes de enviar el HTML
async function getStats() {
  const today = new Date().toISOString().split('T')[0]

  // Ejecutamos 3 consultas en paralelo (Promise.all) para que sea rapidísimo
  const [espera, atendidos, modulos] = await Promise.all([
    supabase.from('turnos').select('*', { count: 'exact', head: true }).eq('estado', 'en espera'),
    supabase.from('turnos').select('*', { count: 'exact', head: true }).eq('estado', 'atendido').gte('hora_finalizacion', today),
    supabase.from('modulos').select('*', { count: 'exact', head: true }).eq('estado', 'activo')
  ])

  return {
    espera: espera.count || 0,
    atendidos: atendidos.count || 0,
    activos: modulos.count || 0
  }
}

export default async function AdminDashboard() {
  const stats = await getStats()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard General</h2>
        <p className="text-slate-400 mt-1">Resumen de la operación en tiempo real.</p>
      </div>

      {/* GRID DE TARJETAS (KPIS) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        <StatCard 
          title="En Espera" 
          value={stats.espera} 
          icon={<Clock className="h-6 w-6 text-yellow-500" />} 
          trend="Personas en sala"
        />
        
        <StatCard 
          title="Atendidos Hoy" 
          value={stats.atendidos} 
          icon={<CheckCircle2 className="h-6 w-6 text-green-500" />} 
          trend="Finalizados"
        />

        <StatCard 
          title="Módulos Activos" 
          value={stats.activos} 
          icon={<Users className="h-6 w-6 text-blue-500" />} 
          trend="Funcionarios online"
        />

        <StatCard 
          title="Tiempo Promedio" 
          value="12m" 
          icon={<AlertCircle className="h-6 w-6 text-purple-500" />} 
          trend="Espera estimada"
        />

      </div>

      {/* AQUÍ IRÍA LA TABLA DE ESTADO EN TIEMPO REAL */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-lg font-medium text-white mb-4">Actividad Reciente</h3>
        <div className="h-64 flex items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-lg">
           Próximamente: Gráficos y Tabla Realtime
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, trend }: any) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <div className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="tracking-tight text-sm font-medium text-slate-400">{title}</h3>
        {icon}
      </div>
      <div className="pt-2">
        <div className="text-2xl font-bold text-white">{value}</div>
        <p className="text-xs text-slate-500 mt-1">{trend}</p>
      </div>
    </div>
  )
}