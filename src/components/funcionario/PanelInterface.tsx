'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { logoutAction } from '@/actions/auth'
import { recallTurnAction } from '@/actions/funcionario-actions'
import {
  Megaphone, RotateCcw, CheckCircle, LogOut,
  User, MapPin, Bell, Loader2, Volume2, Moon, Sun, ArrowRightLeft
} from 'lucide-react'
import { toast, Toaster } from 'sonner'
import ChatWidget from '@/components/chat/ChatWidget'
import TransferModal from './TransferModal'
import { useTheme } from 'next-themes'
import { useBranding } from '@/components/providers/BrandingProvider' // <--- 1. IMPORTAR
import BrandingLogo from '@/components/ui/branding-logo'

// Tipos
type UserSession = {
  id: number
  nombre: string
  rol: string
  modulo: number
}

export default function PanelInterface({ user }: { user: UserSession }) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { logoUrl } = useBranding()
  const [mounted, setMounted] = useState(false)

  // Estados
  const [turnoActual, setTurnoActual] = useState<any>(null)
  const [pendientes, setPendientes] = useState<any[]>([])
  const [moduloNombre, setModuloNombre] = useState('Cargando...')
  const [loadingAction, setLoadingAction] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. CARGAR DATOS
  const loadData = useCallback(async () => {
    // Módulo
    if (user.modulo) {
      const { data } = await supabase.from('modulos').select('nombre_modulo').eq('id_modulo', user.modulo).single()
      if (data) setModuloNombre(data.nombre_modulo)
    } else {
      setModuloNombre("Sin asignar")
    }

    // Turno Actual
    const { data: actual } = await supabase
      .from('turnos')
      .select('id_turno, prefijo_turno, numero_turno, servicios(nombre_servicio), clientes(nombre_completo)')
      .eq('estado', 'en atencion')
      .eq('id_modulo_atencion', user.modulo)
      .maybeSingle()

    setTurnoActual(actual)

    // Pendientes (Lógica mejorada para incluir reasignados)
    // Buscamos turnos donde: (servicio IN mis_servicios AND reasignado IS null) OR (reasignado = mi_modulo)
    // Por simplicidad en este ejemplo, traemos todos los pendientes + reasignados a mí
    const { data: listaPendientes } = await supabase
      .from('turnos')
      .select('id_turno, prefijo_turno, numero_turno, servicios(nombre_servicio)')
      .eq('estado', 'en espera')
      .or(`id_modulo_reasignado.eq.${user.modulo},id_modulo_reasignado.is.null`)
      .order('hora_solicitud', { ascending: true })
      .limit(10)

    if (listaPendientes) setPendientes(listaPendientes)

  }, [supabase, user.modulo])

  useEffect(() => {
    setMounted(true)
    loadData()
    const channel = supabase.channel('panel_funcionario_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData, supabase])


  // 2. ACCIONES

  const llamarSiguiente = async () => {
    if (!user.modulo) return toast.error("No tienes módulo asignado")
    setLoadingAction(true)

    try {
      // 1. LLAMAMOS AL RPC (La función inteligente que creamos en SQL)
      const { data: turnos, error: rpcError } = await supabase.rpc('obtener_siguiente_turno', {
        _id_modulo: user.modulo
      })

      if (rpcError) throw rpcError

      // El RPC devuelve un array, tomamos el primero
      const siguiente = turnos && turnos.length > 0 ? turnos[0] : null

      if (!siguiente) {
        toast.info("No hay turnos pendientes para tus servicios asignados")
        return
      }

      // 2. ACTUALIZAMOS EL ESTADO DEL TURNO
      const { error: updateError } = await supabase
        .from('turnos')
        .update({
          estado: 'en atencion',
          id_modulo_atencion: user.modulo,
          hora_llamado: new Date().toISOString()
        })
        .eq('id_turno', siguiente.id_turno)

      if (updateError) throw updateError

      // 3. BROADCAST PARA QUE SUENE EN EL TV
      await supabase.channel('sistema_turnos').send({
        type: 'broadcast', event: 'nuevo_llamado', payload: { id_turno: siguiente.id_turno }
      })

      toast.success(`Llamando turno: ${siguiente.prefijo_turno}-${siguiente.numero_turno}`)

    } catch (e: any) {
      console.error(e)
      toast.error("Error al llamar: " + e.message)
    } finally {
      setLoadingAction(false)
    }
  }

  const rellamarTurno = async () => {
    if (!turnoActual) return
    setLoadingAction(true)
    const res = await recallTurnAction(turnoActual.id_turno)

    // CORRECCIÓN: Canal 'sistema_turnos', evento 'rellamar'
    await supabase.channel('visualizador_v2_logic').send({
      type: 'broadcast',
      event: 'rellamar',
      payload: { id_turno: turnoActual.id_turno } // Enviamos el ID para verificar
    })

    setLoadingAction(false)
    if (res.success) toast.success("Rellamando turno...")
    else toast.error("Error al rellamar")
  }

  const finalizarTurno = async () => {
    if (!turnoActual) return
    setLoadingAction(true)
    try {
      const { error } = await supabase
        .from('turnos')
        .update({ estado: 'atendido', hora_finalizacion: new Date().toISOString() })
        .eq('id_turno', turnoActual.id_turno)

      if (error) throw error
      toast.success("Turno finalizado")
      setTurnoActual(null)
    } catch (e) {
      toast.error("Error al finalizar")
    } finally {
      setLoadingAction(false)
    }
  }

  const pedirSilencio = async () => {
    await supabase.channel('visualizador_v2_logic').send({
      type: 'broadcast',
      event: 'silence_alert',
      payload: { message: 'Silencio' }
    })
    toast.success("Alerta de silencio enviada al TV")
  }

  const handleLogout = async () => {
    await logoutAction()
    router.push('/login')
  }

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col lg:flex-row transition-colors duration-300">
      <Toaster richColors position="top-right" />

      {/* Modal de Transferencia */}
      <TransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        turnId={turnoActual?.id_turno}
        currentModuleId={user.modulo}
      />

      {/* SIDEBAR */}
      <aside className="w-full lg:w-72 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800 shadow-xl z-20 transition-colors">
        <div>
          <div className="flex items-center justify-center mb-10 mt-4">
             <BrandingLogo className="h-16 w-auto max-w-[80%]" fallbackClass="h-14 w-14 text-2xl" />
          </div>

          <div className="space-y-6">
            <div className="bg-slate-100 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 font-bold">Funcionario</p>
              <div className="flex items-center gap-3 font-medium text-slate-900 dark:text-slate-100">
                {/* Cambiamos blue por brand */}
                <div className="p-2 bg-brand-100 dark:bg-brand-500/10 rounded-lg text-brand-600 dark:text-brand-400"><User size={18} /></div>
                {user.nombre}
              </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 font-bold">Ubicación</p>
              <div className="flex items-center gap-3 font-medium text-slate-900 dark:text-yellow-400">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-500/10 rounded-lg text-yellow-600 dark:text-yellow-400"><MapPin size={18} /></div>
                {moduloNombre}
              </div>
            </div>

            <button onClick={pedirSilencio} className="w-full py-3 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-yellow-400 text-yellow-600 dark:text-yellow-500 font-bold transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center gap-2 group">
              <Volume2 className="group-hover:animate-pulse" /> Pedir Silencio
            </button>
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
            {mounted && (theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />)}
            Modo {mounted && (theme === 'dark' ? 'Día' : 'Noche')}
          </button>
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950 relative transition-colors">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUMNA IZQUIERDA: PENDIENTES */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col h-[500px] transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <Bell size={20} className="text-brand-500 dark:text-brand-400" />
                <h3 className="font-bold text-slate-800 dark:text-white">En Espera</h3>
                <span className="ml-auto bg-brand-100 dark:bg-brand-600 text-brand-700 dark:text-white text-xs px-2 py-1 rounded-full font-bold">{pendientes.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {pendientes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4"><Bell className="h-10 w-10 mb-2 opacity-20" /><p>No hay turnos pendientes</p></div>
                ) : (
                  pendientes.map((p) => (
                    <div key={p.id_turno} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl hover:bg-brand-50 dark:hover:bg-slate-800 transition-colors group cursor-default">
                      <div>
                        <span className="font-mono font-bold text-lg text-slate-700 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors block">{p.prefijo_turno}-{String(p.numero_turno).padStart(3, '0')}</span>
                        {/* @ts-ignore */}
                        <span className="text-slate-500 dark:text-slate-500 text-xs uppercase font-bold">{p.servicios?.nombre_servicio}</span>
                      </div>
                      <div className="h-8 w-1 bg-brand-200 dark:bg-brand-500/20 rounded-full group-hover:bg-brand-500 transition-colors"></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: AREA DE ACCIÓN */}
          <div className="lg:col-span-2 space-y-6">

            {/* TARJETA GIGANTE */}
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 md:p-12 text-center shadow-2xl relative overflow-hidden group transition-colors">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <p className="text-slate-400 uppercase tracking-[0.2em] text-xs font-bold mb-8">Turno en Curso</p>
              {turnoActual ? (
                <div className="animate-in zoom-in duration-300">
                  <div className="text-7xl md:text-9xl font-black text-slate-800 dark:text-white mb-4 tracking-tighter drop-shadow-sm dark:drop-shadow-2xl font-mono">{turnoActual.prefijo_turno}-{String(turnoActual.numero_turno).padStart(3, '0')}</div>
                  <div className="space-y-2">
                    {/* @ts-ignore */}
                    <p className="text-xl md:text-2xl text-brand-600 dark:text-brand-400 font-bold">{turnoActual.servicios?.nombre_servicio}</p>
                    {/* @ts-ignore */}
                    {turnoActual.clientes && <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center justify-center gap-2"><User size={14} /> {turnoActual.clientes.nombre_completo}</p>}
                  </div>
                </div>
              ) : (
                <div className="text-6xl md:text-8xl font-bold text-slate-200 dark:text-slate-800 mb-8 select-none tracking-tighter">---</div>
              )}
            </div>

            {/* BOTONERA DE CONTROL */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              <button
                onClick={llamarSiguiente}
                disabled={loadingAction || !!turnoActual}
                className="col-span-2 h-24 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-blue-500/20 dark:shadow-blue-900/20 disabled:opacity-50 disabled:grayscale transition-all active:scale-95 border-b-4 border-blue-800 hover:border-blue-700 active:border-b-0 active:translate-y-1"
              >
                {loadingAction ? <Loader2 className="animate-spin" /> : <Megaphone size={28} />}
                Llamar Siguiente
              </button>

              <button
                onClick={rellamarTurno}
                disabled={!turnoActual || loadingAction}
                className="col-span-1 h-24 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-yellow-600 dark:text-yellow-400 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
              >
                <RotateCcw size={24} />
                <span className="text-sm">Rellamar</span>
              </button>

              <button
                onClick={() => setTransferOpen(true)}
                disabled={!turnoActual}
                className="col-span-1 h-24 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-purple-600 dark:text-purple-400 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
              >
                <ArrowRightLeft size={24} />
                <span className="text-sm">Transferir</span>
              </button>

              <button
                onClick={finalizarTurno}
                disabled={!turnoActual}
                className="col-span-4 md:col-span-4 h-16 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-green-500/20 dark:shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 border-green-800 hover:border-green-700 active:border-b-0 active:translate-y-1 mt-2"
              >
                <CheckCircle size={24} />
                Finalizar Atención
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* CHAT FLOTANTE */}
      <ChatWidget userId={user.id} userName={user.nombre} />
    </div>
  )
}