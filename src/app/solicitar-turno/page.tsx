'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import VirtualKeyboard from '@/components/kiosco/VirtualKeyboard'
import { Loader2, Printer, ShieldCheck, Square, CheckSquare, ChevronRight, User, Hash } from 'lucide-react'
import { useBranding } from '@/components/providers/BrandingProvider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Step = 'cedula' | 'nombre' | 'servicios' | 'imprimiendo' | 'exito'

export default function KioscoPage() {
  const [step, setStep] = useState<Step>('cedula')
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [servicios, setServicios] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [mensajeTicket, setMensajeTicket] = useState('')
  const [aceptoDatos, setAceptoDatos] = useState(false)
  
  const { logoUrl } = useBranding()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const loadServicios = async () => {
      const { data } = await supabase.from('servicios').select('*').order('id_servicio')
      if (data) setServicios(data)
    }
    loadServicios()
  }, [])

  // --- HANDLERS ---
  const handleKeyPress = (key: string) => {
    if (step === 'cedula') setCedula(prev => prev + key)
    if (step === 'nombre') setNombre(prev => prev + key)
  }

  const handleDelete = () => {
    if (step === 'cedula') setCedula(prev => prev.slice(0, -1))
    if (step === 'nombre') setNombre(prev => prev.slice(0, -1))
  }

  const verificarCedula = async () => {
    if (cedula.length < 5) return // Validación visual en el input mejor
    if (!aceptoDatos) return
    
    setLoading(true)
    const { data } = await supabase.from('clientes').select('nombre_completo').eq('numero_identificacion', cedula).maybeSingle()
    setLoading(false)
    
    if (data) {
      setNombre(data.nombre_completo)
      setStep('servicios')
    } else {
      setStep('nombre')
    }
  }

  const registrarYPedirTurno = async (idServicio: number, nombreServicio: string) => {
    setLoading(true)
    try {
      const { data: cliente } = await supabase.from('clientes').upsert({
        numero_identificacion: cedula,
        nombre_completo: nombre
      }, { onConflict: 'numero_identificacion' }).select('id_cliente').single()

      if (!cliente) throw new Error("Error al registrar cliente")

      const { data: turno, error } = await supabase.rpc('crear_nuevo_turno', {
        _id_servicio: idServicio,
        _id_cliente: cliente.id_cliente
      })

      if (error) throw error

      const datosTurno = turno[0]
      const codigoTurno = `${datosTurno.prefijo_turno}-${String(datosTurno.numero_turno).padStart(3, '0')}`
      const baseUrl = window.location.origin
      const trackingUrl = `${baseUrl}/t/${datosTurno.id_turno}`

      imprimirTicket(codigoTurno, nombreServicio, trackingUrl)

      setMensajeTicket(codigoTurno)
      setStep('exito')

      setTimeout(() => {
        setStep('cedula')
        setCedula('')
        setNombre('')
        setMensajeTicket('')
        setAceptoDatos(false)
      }, 5000)

    } catch (err) {
      console.error(err)
      alert("Error al procesar turno")
    } finally {
      setLoading(false)
    }
  }

  const imprimirTicket = (turno: string, servicio: string, url: string) => {
    const ws = new WebSocket('ws://localhost:8765')
    ws.onopen = () => {
      ws.send(JSON.stringify({ turno, servicio, qr_data: url }))
      ws.close()
    }
  }

  // --- RENDER ---
  return (
    <div className="h-screen w-screen bg-slate-900 text-white overflow-hidden flex flex-col">
      
      {/* HEADER COMPACTO: Siempre visible pero delgado */}
      <header className="h-20 flex-shrink-0 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
           {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />}
           <div className="h-8 w-[1px] bg-slate-700 mx-2"></div>
           <h1 className="text-xl font-bold text-slate-300">Solicitud de Turnos</h1>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
           Sistema Activo
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL (Sin Scroll) */}
      <main className="flex-1 w-full h-full relative flex items-center justify-center p-4 lg:p-12">
        
        {/* PASO 1: CÉDULA (Layout Dividido) */}
        {step === 'cedula' && (
          <div className="w-full max-w-7xl h-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center animate-in fade-in slide-in-from-right duration-300">
            
            {/* COLUMNA IZQUIERDA: INPUT Y ACCIONES */}
            <div className="flex flex-col justify-center h-full space-y-8">
               
               <div className="space-y-2">
                 <label className="text-brand-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                    <Hash size={16}/> Paso 1 de 3
                 </label>
                 <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
                    Ingrese su número de documento
                 </h2>
                 <p className="text-slate-400 text-lg">
                    Digite su cédula sin puntos ni comas.
                 </p>
               </div>

               {/* Input Gigante */}
               <div className="relative">
                 <input 
                    type="text" 
                    readOnly 
                    value={cedula} 
                    className={`w-full bg-slate-800 border-4 rounded-2xl p-6 text-center text-5xl lg:text-6xl font-mono tracking-widest outline-none transition-all ${cedula ? 'border-brand-500 text-white' : 'border-slate-700 text-slate-500'}`}
                    placeholder="--- --- ---" 
                 />
                 {cedula.length > 0 && (
                    <button onClick={handleDelete} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 p-2">
                        BORRAR
                    </button>
                 )}
               </div>

               {/* Legal y Botón */}
               <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-6">
                 {/* Checkbox Legal */}
                 <div onClick={() => setAceptoDatos(!aceptoDatos)} className="flex items-start gap-4 cursor-pointer group">
                    <div className={`mt-1 transition-colors ${aceptoDatos ? 'text-brand-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
                        {aceptoDatos ? <CheckSquare size={32} /> : <Square size={32} />}
                    </div>
                    <div className="text-base text-slate-300 leading-snug select-none">
                        Acepto la <span className="text-brand-400 font-bold">Política de Tratamiento de Datos</span> (Ley 1581 de 2012).
                    </div>
                 </div>

                 {/* Botón Continuar */}
                 <button 
                    onClick={verificarCedula} 
                    disabled={!aceptoDatos || cedula.length < 4} 
                    className="w-full h-20 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl text-2xl font-bold shadow-xl shadow-brand-900/20 disabled:shadow-none transition-all flex items-center justify-center gap-3"
                 >
                    {loading ? <Loader2 className="animate-spin w-8 h-8" /> : <>CONTINUAR <ChevronRight size={32}/></>}
                 </button>

                 {/* Link Modal */}
                 <Dialog>
                    <DialogTrigger asChild>
                        <button className="w-full text-center text-xs text-slate-500 hover:text-white underline py-2">
                            Leer política completa
                        </button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Protección de Datos</DialogTitle>
                            <DialogDescription asChild>
                                <div className="text-slate-300 text-sm space-y-4 pt-4">
                                    <p>
                                En cumplimiento de la <strong>Ley 1581 de 2012</strong>, informamos que los datos recolectados serán tratados de manera responsable y segura.
                            </p>
                            
                            <div>
                                <strong className="block text-white mb-1">Finalidad:</strong>
                                Gestión de turnos, organización de actividades notariales y análisis estadísticos de calidad del servicio.
                            </div>

                            <div>
                                <strong className="block text-white mb-1">Sus Derechos:</strong>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Conocer, actualizar y rectificar sus datos.</li>
                                    <li>Solicitar prueba de la autorización.</li>
                                    <li>Revocar autorización o solicitar supresión.</li>
                                </ul>
                            </div>

                            <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 mt-2">
                                <p className="text-xs text-slate-400">Para ejercer estos derechos comuníquese a:</p>
                                <p className="font-mono text-brand-400 font-bold">terceravalledupar@supernotariado.gov.co</p>
                            </div>
                                </div>
                            </DialogDescription>
                        </DialogHeader>
                    </DialogContent>
                 </Dialog>
               </div>
            </div>

            {/* COLUMNA DERECHA: TECLADO NUMÉRICO */}
            <div className="flex items-center justify-center h-full bg-slate-800/30 rounded-3xl border border-slate-800 p-8">
               <VirtualKeyboard mode="numeric" onKeyPress={handleKeyPress} onDelete={handleDelete} onEnter={verificarCedula} />
            </div>

          </div>
        )}

        {/* PASO 2: NOMBRE (Layout Dividido) */}
        {step === 'nombre' && (
          <div className="w-full max-w-7xl h-full grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 items-center animate-in fade-in slide-in-from-right duration-300">
             
             {/* Columna Izq: Datos */}
             <div className="flex flex-col justify-center space-y-8">
                <div className="space-y-2">
                    <label className="text-brand-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                        <User size={16}/> Paso 2 de 3
                    </label>
                    <h2 className="text-4xl font-bold text-white">¿Cuál es su nombre?</h2>
                    <p className="text-slate-400">Lo usaremos para llamarlo en pantalla.</p>
                </div>
                <input 
                    type="text" 
                    readOnly 
                    value={nombre} 
                    className="w-full bg-slate-800 border-4 border-slate-700 focus:border-brand-500 rounded-2xl p-6 text-3xl font-bold text-white outline-none"
                    placeholder="Escriba aquí..." 
                />
                <div className="flex gap-4">
                    <button onClick={() => setStep('cedula')} className="flex-1 h-16 rounded-xl border-2 border-slate-700 text-slate-400 font-bold hover:bg-slate-800 hover:text-white transition-all">
                        VOLVER
                    </button>
                    <button onClick={() => setStep('servicios')} disabled={nombre.length < 3} className="flex-[2] h-16 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:grayscale transition-all">
                        SIGUIENTE
                    </button>
                </div>
             </div>

             {/* Columna Der: Teclado QWERTY */}
             <div className="bg-slate-800/30 rounded-3xl border border-slate-800 p-6 flex items-center justify-center h-full">
                <VirtualKeyboard mode="qwerty" onKeyPress={handleKeyPress} onDelete={handleDelete} onEnter={() => setStep('servicios')} />
             </div>
          </div>
        )}

        {/* PASO 3: SERVICIOS (Grid Optimizado) */}
        {step === 'servicios' && (
           <div className="w-full max-w-7xl h-full flex flex-col animate-in fade-in zoom-in duration-300">
              <div className="text-center mb-8 flex-shrink-0">
                  <h2 className="text-3xl font-bold text-white">Hola, <span className="text-brand-400">{nombre}</span></h2>
                  <p className="text-slate-400 text-xl">Seleccione el trámite que desea realizar</p>
              </div>

              {/* Grid Auto-ajustable */}
              <div className="flex-1 overflow-y-auto pb-8 px-4">
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 h-full content-center">
                    {servicios.map((serv) => (
                        <button 
                            key={serv.id_servicio} 
                            onClick={() => registrarYPedirTurno(serv.id_servicio, serv.nombre_servicio)} 
                            disabled={loading} 
                            className="relative h-48 lg:h-64 bg-slate-800 border-2 border-slate-700 rounded-3xl p-6 hover:bg-brand-600 hover:border-brand-400 hover:-translate-y-2 hover:shadow-2xl hover:shadow-brand-900/40 transition-all group flex flex-col justify-between overflow-hidden text-left"
                        >
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
                            
                            <div className="text-5xl font-black text-slate-700 group-hover:text-white/30 transition-colors">
                                {serv.prefijo_ticket}
                            </div>
                            
                            <div>
                                <h3 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-2">
                                    {serv.nombre_servicio}
                                </h3>
                                <div className="h-1 w-12 bg-brand-500 group-hover:bg-white transition-colors rounded-full"></div>
                            </div>
                        </button>
                    ))}
                  </div>
              </div>
              
              <div className="text-center pt-4 flex-shrink-0">
                 <button onClick={() => setStep('cedula')} className="text-slate-500 hover:text-white underline py-4 text-lg">
                    Cancelar y Volver al Inicio
                 </button>
              </div>
           </div>
        )}

        {/* PASO 4: ÉXITO */}
        {step === 'exito' && (
            <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                <div className="w-40 h-40 bg-green-500 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(34,197,94,0.4)] animate-bounce">
                    <Printer size={80} className="text-white" />
                </div>
                <h2 className="text-5xl font-bold text-white mb-4">¡Turno Generado!</h2>
                <div className="bg-white text-black p-8 rounded-2xl w-80 rotate-2 shadow-2xl">
                    <div className="border-b-4 border-dashed border-gray-300 pb-6 mb-6 text-center">
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Su Turno es</p>
                        <p className="text-7xl font-black text-gray-900 mt-2">{mensajeTicket}</p>
                    </div>
                    <p className="text-sm text-center text-gray-500 font-medium">Por favor tome su ticket impreso</p>
                </div>
            </div>
        )}

      </main>
    </div>
  )
}