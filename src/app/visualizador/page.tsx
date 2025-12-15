'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Ticker from '@/components/visualizador/Ticker'
import StatusGrid from '@/components/visualizador/StatusGrid'
import WeatherWidget from '@/components/visualizador/WeatherWidget'
import BrandingLogo from '@/components/ui/branding-logo'
import DigitalClock from '@/components/visualizador/DigitalClock'
import { useTTS } from '@/hooks/useTTS' // <--- IMPORTAMOS EL HOOK 

export default function VisualizadorPage() {
  //estado visual
  const [view, setView] = useState<'main' | 'grid' | 'ads'>('main')
  const [turnoActual, setTurnoActual] = useState<any>(null)
  const [modulos, setModulos] = useState<any[]>([])
  const [animar, setAnimar] = useState(false)

  //estado de anuncios
  const [anuncios, setAnuncios] = useState<any[]>([])
  const [currentAdIndex, setCurrentAdIndex] = useState(0)

  // Tiempos (Main: 15s, Grid: 10s, Ads: 10s)

  const anunciosRef = useRef<any[]>([])
  const viewRef = useRef<'main' | 'grid' | 'ads'>('main')
  const carouselTimer = useRef<NodeJS.Timeout | null>(null)
  const viewDuration = { main: 15000, grid: 10000, ads: 10000 }

  const { speak } = useTTS() // <--- INICIALIZAMOS LA VOZ

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Sincronizar estado con Ref
  useEffect(() => {
    anunciosRef.current = anuncios
  }, [anuncios])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  // --- LÓGICA DE DATOS ---

  const fetchData = useCallback(async () => {
    // 1. Turno Gigante
    const { data: turno } = await supabase
      .from('turnos')
      .select('*, modulos(nombre_modulo)')
      .eq('estado', 'en atencion')
      .order('hora_llamado', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si cambia el turno, anunciarlo
    setTurnoActual((prev: any) => {
      if (turno && (!prev || turno.id_turno !== prev.id_turno)) {
        triggerAnnouncement(turno)
      }
      return turno
    })

    // 2. Cuadrícula
    const { data: mods } = await supabase
      .from('modulos')
      .select('*, turnos!turnos_id_modulo_atencion_fkey(prefijo_turno, numero_turno, estado)')
      .eq('estado', 'activo')
      .order('nombre_modulo')
    if (mods) setModulos(mods)

    // 3. Anuncios
    const { data: ads } = await supabase
      .from('anuncios_tv')
      .select('*')
      .eq('activo', true)
      .order('orden')
    if (ads) setAnuncios(ads)

  }, [supabase])

  // --- LÓGICA DE CICLO ---

  const cycleView = useCallback(() => {
    const currentView = viewRef.current
    const adsList = anunciosRef.current
    let nextView: 'main' | 'grid' | 'ads' = 'main'

    if (currentView === 'main') {
      nextView = 'grid'
    }
    else if (currentView === 'grid') {
      // Solo ir a ADS si hay anuncios
      nextView = adsList.length > 0 ? 'ads' : 'main'
    }
    else if (currentView === 'ads') {
      // Lógica de rotación interna de ads
      setCurrentAdIndex(prev => {
        if (prev < adsList.length - 1) {
          // Hay más ads, nos quedamos en 'ads' pero siguiente índice
          // (El setState es asíncrono, así que forzamos nextView aquí)
          return prev + 1
        } else {
          // Se acabaron, volver a main
          return 0
        }
      })

      // Si no hemos terminado los ads, nos quedamos, sino main
      // (Nota: Esta lógica simplificada asume que setCurrentAdIndex se ejecuta)
      // Para asegurar:
      if (currentAdIndex < adsList.length - 1) {
        nextView = 'ads'
      } else {
        nextView = 'main'
      }
    }

    setView(nextView)
    carouselTimer.current = setTimeout(cycleView, viewDuration[nextView])
  }, [currentAdIndex])

  const resetCarousel = () => {
    if (carouselTimer.current) clearTimeout(carouselTimer.current)
    carouselTimer.current = setTimeout(cycleView, viewDuration.main)
  }

  //anuncio

  // Utilidad para limpiar el texto (Ej: "A-005" -> "Turno A cinco")
  const formatTextForSpeech = (prefijo: string, numero: number, modulo: string) => {
    // Quitamos la palabra "Módulo" para que no sea redundante si ya la dice
    const nombreModulo = modulo.replace(/Módulo|Modulo/i, '').trim()
    return `Turno ${prefijo} ${numero}. Diríjase al módulo ${nombreModulo}`
  }

  const triggerAnnouncement = (turno: any) => {
    console.log("📣 ANUNCIO:", turno)
    setView('main') // Forzar vista
    setAnimar(true)

    // Detener carrusel momentáneamente
    if (carouselTimer.current) clearTimeout(carouselTimer.current)

    // Sonidos
    const audio = new Audio('/sounds/bell.mp3')
    audio.play().catch(() => { })

    setTimeout(() => {
      const speechText = formatTextForSpeech(turno.prefijo_turno, turno.numero_turno, turno.modulos.nombre_modulo)
      speak(speechText)
      setAnimar(false)
      // Reiniciar carrusel después del anuncio
      resetCarousel()
    }, 1500)
  }

  const playSilenceAudio = () => {
    console.log("🤫 SOLICITUD DE SILENCIO RECIBIDA")
    const audio = new Audio('/sounds/silencio.mp3')
    audio.play().catch(e => console.error("Error al reproducir silencio:", e))

    // Opcional: Mostrar una alerta visual temporal en pantalla
    const alertDiv = document.createElement('div')
    // alertDiv.innerText = "⚠️ POR FAVOR, GUARDAR SILENCIO ⚠️"
    // alertDiv.style.position = 'fixed'
    // alertDiv.style.top = '20%'
    // alertDiv.style.left = '50%'
    // alertDiv.style.transform = 'translate(-50%, -50%)'
    // alertDiv.style.backgroundColor = 'red'
    // alertDiv.style.color = 'white'
    // alertDiv.style.padding = '40px'
    // alertDiv.style.fontSize = '3rem'
    // alertDiv.style.fontWeight = 'bold'
    // alertDiv.style.borderRadius = '20px'
    // alertDiv.style.zIndex = '9999'
    // alertDiv.style.boxShadow = '0 0 50px rgba(255,0,0,0.5)'
    alertDiv.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in zoom-in duration-300"
    alertDiv.innerHTML = `<h1 class="text-6xl md:text-9xl font-black text-red-500 animate-pulse text-center">SILENCIO<br/><span class="text-4xl text-white">POR FAVOR</span></h1>`

    document.body.appendChild(alertDiv)

    setTimeout(() => {
      document.body.removeChild(alertDiv)
    }, 5000) // Quitar letrero a los 5 segundos
  }

  //INIT

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
        if (turnoActual && turnoActual.id_turno === payload.payload.id_turno) {
          triggerAnnouncement(turnoActual)
        } else {
          fetchData()
        }
      })

      // 3. Silencio
      .on('broadcast', { event: 'silence_alert' }, () => {
        console.log("📡 Recibido: Silencio")
        playSilenceAudio()
      })

      // 4. Cambios en la DB (Respaldo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, fetchData)
      // Escuchar cambios en anuncios también
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anuncios_tv' }, fetchData)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (carouselTimer.current) clearTimeout(carouselTimer.current)
    }
  }, [])

  return (
    <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden relative flex flex-col items-center justify-center">

      {/* --- CAPA SUPERIOR FIJA (Widgets) --- */}
      
      {/* 1. Clima (Izquierda) */}
      <div className="absolute top-6 left-8 z-50">
        <WeatherWidget />
      </div>

      {/* 2. Reloj (Derecha) - Siempre visible */}
      <div className="absolute top-6 right-8 z-50">
        <DigitalClock />
      </div>

      {/* 3. Logo (Derecha, debajo del reloj) - SOLO EN MAIN */}
      {view === 'main' && (
        <div className="absolute top-24 right-8 z-40 animate-in fade-in zoom-in duration-700">
           <BrandingLogo className="h-20 w-auto drop-shadow-2xl" />
        </div>
      )}

      {/* --- FONDO ANIMADO --- */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-900/20 via-slate-950 to-slate-950 z-0"></div>

      {/* --- VISTA A: TURNO GIGANTE --- */}
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
              <div className="mt-8 bg-gradient-to-r from-brand-600 to-cyan-500 px-12 py-4 rounded-full shadow-2xl animate-bounce">
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

      {/* --- VISTA B: CUADRÍCULA (GRID) --- */}
      {view === 'grid' && (
        <div className="z-10 w-full h-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-10 duration-700">
          
          {/* TÍTULO (Fijo arriba) */}
          {/* pt-24 para separarlo del reloj/logo */}
          <div className="pt-24 pb-4 flex-shrink-0">
             <h2 className="text-2xl font-bold uppercase tracking-widest text-slate-400">
               Estado de Módulos
             </h2>
          </div>

          {/* CONTENEDOR DEL GRID (Flexible) */}
          {/* pb-20 es el espacio para el Ticker abajo */}
          {/* flex-grow hace que este div ocupe todo el espacio vertical sobrante */}
          <div className="flex-grow w-full pb-20 px-10 overflow-hidden">
             <StatusGrid modules={modulos} />
          </div>
          
        </div>
      )}

      {/* --- VISTA C: ANUNCIOS --- */}
      {view === 'ads' && anuncios.length > 0 && (
        <div className="z-10 w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-1000 px-10 pb-20 pt-24">
          <div className="relative w-full h-full max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-black">
            <img
              src={anuncios[currentAdIndex].imagen_url}
              alt="Anuncio"
              className="w-full h-full object-contain"
            />
            {anuncios[currentAdIndex].titulo && (
              <div className="absolute bottom-0 w-full bg-black/70 p-6 text-center backdrop-blur-md">
                <h2 className="text-3xl font-bold text-white">{anuncios[currentAdIndex].titulo}</h2>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            {anuncios.map((_, idx) => (
              <div key={idx} className={`h-2 w-8 rounded-full transition-all ${idx === currentAdIndex ? 'bg-brand-500' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>
      )}

      <Ticker />
    </div>
  )
}