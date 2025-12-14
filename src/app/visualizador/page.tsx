'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Ticker from '@/components/visualizador/Ticker'
import StatusGrid from '@/components/visualizador/StatusGrid'
import { useTTS } from '@/hooks/useTTS' // <--- IMPORTAMOS EL HOOK 

export default function VisualizadorPage() {
  const [view, setView] = useState<'main' | 'grid'>('main')
  const [turnoActual, setTurnoActual] = useState<any>(null)
  const [modulos, setModulos] = useState<any[]>([])
  const [animar, setAnimar] = useState(false)
  
  const carouselTimer = useRef<NodeJS.Timeout | null>(null)
  const viewDuration = { main: 15000, grid: 10000 }

  const { speak } = useTTS() // <--- INICIALIZAMOS LA VOZ

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Utilidad para limpiar el texto (Ej: "A-005" -> "Turno A cinco")
  const formatTextForSpeech = (prefijo: string, numero: number, modulo: string) => {
    // Quitamos la palabra "Módulo" para que no sea redundante si ya la dice
    const nombreModulo = modulo.replace(/Módulo|Modulo/i, '').trim()
    return `Turno ${prefijo} ${numero}. Diríjase al módulo ${nombreModulo}`
  }

  const fetchData = async () => {
    // A. Turno Gigante
    const { data: turno } = await supabase
      .from('turnos')
      .select('*, modulos(nombre_modulo)')
      .eq('estado', 'en atencion')
      .order('hora_llamado', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    // Detectar nuevo llamado
    if (turno && (!turnoActual || turno.id_turno !== turnoActual.id_turno)) {
       triggerAnnouncement(turno)
    }
    setTurnoActual(turno)

    // B. Cuadrícula
    const { data: mods } = await supabase
        .from('modulos')
        .select('*, turnos!turnos_id_modulo_atencion_fkey(prefijo_turno, numero_turno, estado)')
        .eq('estado', 'activo')
        .order('nombre_modulo')
    
    if (mods) setModulos(mods)
  }

  const triggerAnnouncement = (turno: any) => {
    console.log("📣 NUEVO LLAMADO (Local):", turno)
    
    // 1. Forzar vista principal
    setView('main')
    setAnimar(true)
    setTimeout(() => setAnimar(false), 2000)
    resetCarousel()

    // 2. SONIDO DE CAMPANA (Ding-Dong) 🔔
    // Asegúrate de tener un archivo 'bell.mp3' en la carpeta /public
    const audio = new Audio('/sounds/bell.mp3') 
    audio.play().catch(e => console.log("Falta interacción usuario"))

    // 3. VOZ INMEDIATA (TTS NATIVO) 🗣️
    // Esperamos 1 segundito para que suene la campana primero
    setTimeout(() => {
        const speechText = formatTextForSpeech(turno.prefijo_turno, turno.numero_turno, turno.modulos.nombre_modulo)
        speak(speechText)
    }, 1000)
  }

  const resetCarousel = () => {
    if (carouselTimer.current) clearTimeout(carouselTimer.current)
    carouselTimer.current = setTimeout(cycleView, viewDuration.main)
  }

  const cycleView = () => {
    setView(prev => {
        const next = prev === 'main' ? 'grid' : 'main'
        carouselTimer.current = setTimeout(cycleView, viewDuration[next])
        return next
    })
  }

  const playSilenceAudio = () => {
    console.log("🤫 SOLICITUD DE SILENCIO RECIBIDA")
    const audio = new Audio('/sounds/silencio.mp3')
    audio.play().catch(e => console.error("Error al reproducir silencio:", e))
    
    // Opcional: Mostrar una alerta visual temporal en pantalla
    const alertDiv = document.createElement('div')
    alertDiv.innerText = "⚠️ POR FAVOR, GUARDAR SILENCIO ⚠️"
    alertDiv.style.position = 'fixed'
    alertDiv.style.top = '20%'
    alertDiv.style.left = '50%'
    alertDiv.style.transform = 'translate(-50%, -50%)'
    alertDiv.style.backgroundColor = 'red'
    alertDiv.style.color = 'white'
    alertDiv.style.padding = '40px'
    alertDiv.style.fontSize = '3rem'
    alertDiv.style.fontWeight = 'bold'
    alertDiv.style.borderRadius = '20px'
    alertDiv.style.zIndex = '9999'
    alertDiv.style.boxShadow = '0 0 50px rgba(255,0,0,0.5)'
    document.body.appendChild(alertDiv)

    setTimeout(() => {
        document.body.removeChild(alertDiv)
    }, 5000) // Quitar letrero a los 5 segundos
  }
  
  useEffect(() => {
    fetchData()
    resetCarousel()

    // CORRECCIÓN: Escuchamos todo en 'sistema_turnos'
    const channel = supabase.channel('visualizador_v2_logic')
      
      // 1. Nuevo Llamado
      .on('broadcast', { event: 'nuevo_llamado' }, () => {
          console.log("📡 Recibido: Nuevo Llamado")
          fetchData() // Recargar datos de la DB
      })
      
      // 2. Rellamar
      .on('broadcast', { event: 'rellamar' }, (payload) => {
          console.log("📡 Recibido: Rellamar", payload)
          // Forzamos el anuncio incluso si el turno no ha cambiado en la DB
          // Nota: payload.payload contiene los datos enviados
          if (turnoActual) {
             triggerAnnouncement(turnoActual)
          } else {
             fetchData() // Por si acaso
          }
      })
      
      // 3. Silencio
      .on('broadcast', { event: 'silence_alert' }, () => {
          console.log("📡 Recibido: Silencio")
          playSilenceAudio()
      })
      
      // 4. Cambios en la DB (Respaldo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, fetchData)
      .subscribe()

    return () => { 
        supabase.removeChannel(channel)
        if (carouselTimer.current) clearTimeout(carouselTimer.current)
    }
  }, [turnoActual])

  return (
    <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden relative flex flex-col items-center justify-center">
      
      {/* Fondo Animado */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 z-0"></div>

      {/* VISTA A: TURNO GIGANTE */}
      {view === 'main' && (
        <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-700">
            <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.3em] text-slate-500 mb-4">
            Turno Actual
            </h2>

            {turnoActual ? (
                <>
                    <div className={`font-black text-[20vw] leading-none text-white drop-shadow-[0_0_60px_rgba(59,130,246,0.6)] transition-transform duration-500 ${animar ? 'scale-110' : 'scale-100'}`}>
                    {turnoActual.prefijo_turno}-{String(turnoActual.numero_turno).padStart(3, '0')}
                    </div>
                    <div className="mt-8 bg-gradient-to-r from-blue-600 to-cyan-500 px-12 py-4 rounded-full shadow-2xl animate-bounce">
                        <span className="text-4xl md:text-6xl font-bold text-white uppercase tracking-wide">
                            {turnoActual.modulos?.nombre_modulo}
                        </span>
                    </div>
                </>
            ) : (
                <div className="text-6xl text-slate-700 font-bold">Esperando...</div>
            )}
        </div>
      )}

      {/* VISTA B: CUADRÍCULA */}
      {view === 'grid' && (
        <div className="z-10 w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-10 duration-700">
            <h2 className="text-2xl font-bold uppercase tracking-widest text-slate-400 mb-8">Estado de Módulos</h2>
            <StatusGrid modules={modulos} />
        </div>
      )}

      {/* MARQUESINA */}
      <Ticker />
    </div>
  )
}