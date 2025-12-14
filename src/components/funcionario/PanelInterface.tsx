'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { logoutAction } from '@/actions/auth'
import { 
  Megaphone, RotateCcw, CheckCircle, LogOut, 
  User, MapPin, Bell, Loader2 
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

// Tipos para TypeScript (ayudan mucho a no cometer errores)
type UserSession = {
  id: number
  nombre: string
  rol: string
  modulo: number
}

export default function PanelInterface({ user }: { user: UserSession }) {
  const router = useRouter()
  const [turnoActual, setTurnoActual] = useState<any>(null)
  const [pendientes, setPendientes] = useState<any[]>([])
  const [moduloNombre, setModuloNombre] = useState('Cargando...')
  const [loadingAction, setLoadingAction] = useState(false)

  // Cliente Supabase
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. CARGA INICIAL DE DATOS
  const loadData = useCallback(async () => {
    // A. Obtener nombre del módulo
    if (user.modulo) {
      const { data } = await supabase.from('modulos').select('nombre_modulo').eq('id_modulo', user.modulo).single()
      if (data) setModuloNombre(data.nombre_modulo)
    } else {
        setModuloNombre("Sin asignar")
    }

    // B. Obtener Turno Actual (En atención)
    const { data: actual } = await supabase
      .from('turnos')
      .select('id_turno, prefijo_turno, numero_turno, servicios(nombre_servicio)')
      .eq('estado', 'en atencion')
      .eq('id_modulo_atencion', user.modulo)
      .maybeSingle()
    
    setTurnoActual(actual)

    // C. Obtener Pendientes (Simplificado: trae los en espera)
    // NOTA: Aquí deberías replicar tu lógica de servicios asignados. 
    // Por simplicidad, traeremos los últimos 5 pendientes globales o de su módulo reasignado.
    const { data: listaPendientes } = await supabase
        .from('turnos')
        .select('id_turno, prefijo_turno, numero_turno, servicios(nombre_servicio)')
        .eq('estado', 'en espera')
        .order('hora_solicitud', { ascending: true })
        .limit(5)
    
    if (listaPendientes) setPendientes(listaPendientes)

  }, [supabase, user.modulo])

  useEffect(() => {
    loadData()

    // 2. REALTIME (La magia)
    const channel = supabase.channel('panel_funcionario')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, () => {
        console.log("Cambio detectado, recargando...")
        loadData() // Recargar todo si algo cambia
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadData, supabase])


  // 3. ACCIONES (BOTONES)

  const llamarSiguiente = async () => {
    if (!user.modulo) return toast.error("No tienes módulo asignado")
    setLoadingAction(true)

    try {
        // Lógica simple: Tomar el primero de la lista (Mejora esto con RPC luego)
        // Buscamos el siguiente turno disponible (esto debería ser más robusto en producción)
        const { data: siguiente } = await supabase
            .from('turnos')
            .select('id_turno')
            .eq('estado', 'en espera')
            .order('hora_solicitud', { ascending: true })
            .limit(1)
            .maybeSingle()

        if (!siguiente) {
            toast.info("No hay turnos en espera")
            return
        }

        // Actualizar turno
        const { error } = await supabase
            .from('turnos')
            .update({ 
                estado: 'en atencion', 
                id_modulo_atencion: user.modulo,
                hora_llamado: new Date().toISOString()
            })
            .eq('id_turno', siguiente.id_turno)

        if (error) throw error
        toast.success("Turno llamado")

    } catch (e) {
        console.error(e)
        toast.error("Error al llamar")
    } finally {
        setLoadingAction(false)
    }
  }

  const finalizarTurno = async () => {
    if (!turnoActual) return
    setLoadingAction(true)
    try {
        const { error } = await supabase
            .from('turnos')
            .update({ 
                estado: 'atendido', 
                hora_finalizacion: new Date().toISOString() 
            })
            .eq('id_turno', turnoActual.id_turno)

        if (error) throw error
        toast.success("Turno finalizado")
        setTurnoActual(null) // Limpieza optimista
    } catch (e) {
        toast.error("Error al finalizar")
    } finally {
        setLoadingAction(false)
    }
  }

  const handleLogout = async () => {
    await logoutAction()
    router.push('/login')
  }

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row font-sans">
      <Toaster richColors position="top-right" />

      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">T</div>
            <span className="font-bold text-xl">TurnosWeb</span>
          </div>
          
          <div className="space-y-6">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 shadow-sm">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Funcionario</p>
              <div className="flex items-center gap-2 font-medium text-slate-200">
                <User size={16} className="text-blue-400"/>
                {user.nombre}
              </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 shadow-sm">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Ubicación</p>
              <div className="flex items-center gap-2 font-medium text-yellow-400">
                <MapPin size={16} />
                {moduloNombre}
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors mt-auto pt-6"
        >
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        
        <div className="max-w-5xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Panel de Atención</h1>
            <div className="flex gap-2">
               <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-medium border border-green-500/20 flex items-center gap-2 animate-pulse">
                 <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                 En Línea
               </span>
            </div>
          </header>

          {/* Tarjeta Gigante del Turno */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-900/50 border border-slate-800 rounded-3xl p-8 md:p-12 text-center shadow-2xl relative overflow-hidden mb-8 group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600"></div>
            
            <p className="text-slate-400 uppercase tracking-[0.2em] text-sm mb-6 font-medium">Atendiendo Ahora</p>
            
            {turnoActual ? (
              <div className="animate-in zoom-in duration-300">
                <div className="text-7xl md:text-9xl font-black text-white mb-2 tracking-tighter drop-shadow-lg">
                    {turnoActual.prefijo_turno}-{String(turnoActual.numero_turno).padStart(3, '0')}
                </div>
                {/* @ts-ignore */}
                <p className="text-xl md:text-2xl text-blue-400 font-medium bg-blue-900/20 inline-block px-6 py-2 rounded-full border border-blue-500/30">
                  {turnoActual.servicios?.nombre_servicio}
                </p>
              </div>
            ) : (
              <div className="text-6xl md:text-7xl font-bold text-slate-800 mb-4 select-none">---</div>
            )}
          </div>

          {/* Botonera de Control */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10">
            <button 
              onClick={llamarSiguiente}
              disabled={loadingAction || !!turnoActual}
              className="h-20 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 border-blue-800 hover:border-blue-700 disabled:border-transparent"
            >
              {loadingAction ? <Loader2 className="animate-spin" /> : <Megaphone size={24} />}
              Llamar Siguiente
            </button>

            <button 
              disabled={!turnoActual}
              className="h-20 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-yellow-900/20 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-600 transition-all active:scale-95 border-b-4 border-yellow-800 hover:border-yellow-700 disabled:border-transparent"
            >
              <RotateCcw size={24} />
              Rellamar
            </button>

            <button 
              onClick={finalizarTurno}
              disabled={!turnoActual}
              className="h-20 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-600 transition-all active:scale-95 border-b-4 border-green-800 hover:border-green-700 disabled:border-transparent"
            >
              <CheckCircle size={24} />
              Finalizar
            </button>
          </div>

          {/* Lista de Pendientes (Mini Dashboard) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex items-center gap-2">
                <Bell size={18} className="text-slate-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Próximos en Espera</h3>
            </div>
            
            {pendientes.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No hay turnos pendientes</div>
            ) : (
                <div className="divide-y divide-slate-800">
                    {pendientes.map((p) => (
                        <div key={p.id_turno} className="flex justify-between items-center p-4 hover:bg-slate-800/30 transition-colors group">
                            <div className="flex items-center gap-4">
                                <span className="font-mono font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                                    {p.prefijo_turno}-{String(p.numero_turno).padStart(3, '0')}
                                </span>
                                {/* @ts-ignore */}
                                <span className="text-slate-400 text-sm">{p.servicios?.nombre_servicio}</span>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-blue-500/50"></div>
                        </div>
                    ))}
                </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}