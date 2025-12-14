'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Clock, CheckCircle2, Megaphone, ArrowRight } from 'lucide-react'

export default function ClientTrackingView({ initialTurno }: { initialTurno: any }) {
  const [turno, setTurno] = useState(initialTurno)
  const [turnosAntes, setTurnosAntes] = useState(0)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchData = async () => {
    // 1. Refrescar datos del turno
    const { data: t } = await supabase
      .from('turnos')
      .select('*, modulos(nombre_modulo), servicios(nombre_servicio)')
      .eq('id_turno', initialTurno.id_turno)
      .single()
    
    if (t) setTurno(t)

    // 2. Calcular cuántos faltan antes de mí (si estoy en espera)
    if (t && t.estado === 'en espera') {
        const { count } = await supabase
            .from('turnos')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'en espera')
            .lt('id_turno', t.id_turno) // IDs menores = llegaron antes
        
        setTurnosAntes(count || 0)
    }
  }

  useEffect(() => {
    fetchData()
    // Suscripción a cambios
    const channel = supabase.channel(`tracking_${initialTurno.id_turno}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Estilos según estado
  const getStatusColor = () => {
    if (turno.estado === 'en espera') return 'bg-blue-600'
    if (turno.estado === 'en atencion') return 'bg-yellow-500'
    return 'bg-green-600'
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        {/* Header Dinámico */}
        <div className={`${getStatusColor()} p-8 text-white transition-colors duration-500`}>
            <p className="text-sm font-medium uppercase tracking-widest opacity-90 mb-1">Su Turno</p>
            <h1 className="text-6xl font-black tracking-tighter">
                {turno.prefijo_turno}-{String(turno.numero_turno).padStart(3, '0')}
            </h1>
            <p className="mt-2 text-sm opacity-90">{turno.servicios?.nombre_servicio}</p>
        </div>

        {/* Cuerpo */}
        <div className="p-8 space-y-6">
            
            {turno.estado === 'en espera' && (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-center gap-3 text-slate-600 mb-2">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <span className="font-bold text-lg">En Espera</span>
                    </div>
                    <p className="text-slate-500">
                        Hay <strong className="text-slate-800 text-xl">{turnosAntes}</strong> personas antes de usted.
                    </p>
                    <div className="mt-6 p-4 bg-blue-50 text-blue-700 rounded-xl text-sm">
                        Puede esperar cómodamente, la pantalla cambiará cuando le llamen.
                    </div>
                </div>
            )}

            {turno.estado === 'en atencion' && (
                <div className="animate-in zoom-in duration-300">
                    <div className="flex items-center justify-center gap-3 text-yellow-600 mb-4">
                        <Megaphone className="w-6 h-6 animate-bounce" />
                        <span className="font-bold text-2xl">¡ES SU TURNO!</span>
                    </div>
                    <p className="text-slate-600 mb-2">Por favor diríjase al:</p>
                    <div className="text-3xl font-black text-slate-800 uppercase bg-slate-100 py-3 rounded-lg border border-slate-200">
                        {turno.modulos?.nombre_modulo}
                    </div>
                </div>
            )}

            {turno.estado === 'atendido' && (
                <div className="opacity-50 grayscale">
                    <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-bold">Atendido</span>
                    </div>
                    <p className="text-sm text-slate-400">Gracias por su visita.</p>
                </div>
            )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 text-xs text-slate-400 border-t border-slate-100">
            Notaría Tercera de Valledupar
        </div>
      </div>

    </div>
  )
}