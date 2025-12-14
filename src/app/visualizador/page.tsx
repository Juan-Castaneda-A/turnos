'use client' // Esto indica que es un componente que corre en el navegador

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function VisualizadorPage() {
  const [turnoActual, setTurnoActual] = useState<string>('---')
  const [moduloActual, setModuloActual] = useState<string>('Esperando...')
  const [animar, setAnimar] = useState(false)

  // Cliente de Supabase
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Función para cargar el turno
  const fetchTurno = async () => {
    const { data } = await supabase
      .from('turnos')
      .select('prefijo_turno, numero_turno, modulos(nombre_modulo)')
      .eq('estado', 'en atencion')
      .order('hora_llamado', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (data) {
      const nuevoTurno = `${data.prefijo_turno}-${String(data.numero_turno).padStart(3, '0')}`
      // Solo actualizamos y animamos si el turno es diferente
      setTurnoActual(prev => {
        if (prev !== nuevoTurno) {
            setAnimar(true)
            setTimeout(() => setAnimar(false), 1000) // Quitar animación después de 1s
            
            // AQUÍ PODRÍAS PONER EL CÓDIGO DE VOZ (TTS) MÁS ADELANTE
        }
        return nuevoTurno
      })
      // @ts-ignore: Supabase a veces da tipos complejos con joins
      setModuloActual(data.modulos?.nombre_modulo || 'Módulo ?')
    }
  }

  useEffect(() => {
    fetchTurno() // Carga inicial

    // Suscripción Realtime
    const channel = supabase.channel('visualizador_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, (payload) => {
        console.log('Cambio detectado:', payload)
        fetchTurno() // Recargar datos cuando algo cambie
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-white overflow-hidden relative">
      
      {/* Fondo decorativo (Glow) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="z-10 flex flex-col items-center">
        <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-[0.2em] text-slate-400 mb-8">
          Turno Actual
        </h2>

        {/* Número Gigante */}
        <div className={`font-black text-[18vw] leading-none text-white drop-shadow-[0_0_50px_rgba(59,130,246,0.5)] transition-transform duration-500 ${animar ? 'scale-110' : 'scale-100'}`}>
          {turnoActual}
        </div>

        {/* Línea divisoria */}
        <div className="w-64 h-2 bg-blue-600 rounded-full my-10 opacity-50"></div>

        {/* Módulo */}
        <div className="text-5xl md:text-7xl font-bold text-yellow-400 uppercase tracking-wide">
          {moduloActual}
        </div>
      </div>
    </div>
  )
}