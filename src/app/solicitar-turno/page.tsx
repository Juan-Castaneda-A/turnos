'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import VirtualKeyboard from '@/components/kiosco/VirtualKeyboard'
import { Loader2, Printer, CheckCircle } from 'lucide-react'
import { useBranding } from '@/components/providers/BrandingProvider'

// Definimos los pasos del flujo
type Step = 'cedula' | 'nombre' | 'servicios' | 'imprimiendo' | 'exito'

export default function KioscoPage() {
  const [step, setStep] = useState<Step>('cedula')
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [servicios, setServicios] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [mensajeTicket, setMensajeTicket] = useState('')

  const { logoUrl } = useBranding()

  // Cliente Supabase
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Cargar servicios al inicio
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
    if (cedula.length < 5) return alert("Cédula muy corta")
    setLoading(true)

    // Buscamos si existe el cliente
    const { data } = await supabase.from('clientes').select('nombre_completo').eq('numero_identificacion', cedula).maybeSingle()

    setLoading(false)
    if (data) {
      setNombre(data.nombre_completo)
      setStep('servicios') // Ya existe, saltamos al servicio
    } else {
      setStep('nombre') // Nuevo, pedimos nombre
    }
  }

  const registrarYPedirTurno = async (idServicio: number, nombreServicio: string) => {
    setLoading(true)

    try {
      // 1. Guardar/Actualizar Cliente
      const { data: cliente } = await supabase.from('clientes').upsert({
        numero_identificacion: cedula,
        nombre_completo: nombre
      }, { onConflict: 'numero_identificacion' }).select('id_cliente').single()

      if (!cliente) throw new Error("Error al registrar cliente")

      // 2. Crear Turno (RPC)
      const { data: turno, error } = await supabase.rpc('crear_nuevo_turno', {
        _id_servicio: idServicio,
        _id_cliente: cliente.id_cliente
      })

      if (error) throw error

      const datosTurno = turno[0] // El RPC devuelve un array
      const codigoTurno = `${datosTurno.prefijo_turno}-${String(datosTurno.numero_turno).padStart(3, '0')}`

      // --- NUEVO: Generar URL ---
      // Nota: En local será localhost, en producción será tu dominio de Render
      const baseUrl = window.location.origin
      const trackingUrl = `${baseUrl}/t/${datosTurno.id_turno}`

      // 3. Imprimir Ticket (WebSocket Local)
      imprimirTicket(codigoTurno, nombreServicio, trackingUrl)

      // 4. Mostrar Éxito
      setMensajeTicket(codigoTurno)
      setStep('exito')

      // 5. Reset automático
      setTimeout(() => {
        setStep('cedula')
        setCedula('')
        setNombre('')
        setMensajeTicket('')
      }, 5000)

    } catch (err) {
      console.error(err)
      alert("Error al procesar turno")
    } finally {
      setLoading(false)
    }
  }

  const imprimirTicket = (turno: string, servicio: string, url: string) => {
    // Conexión con tu script de Python local
    const ws = new WebSocket('ws://localhost:8765')
    ws.onopen = () => {
      ws.send(JSON.stringify({ turno, servicio, qr_data: url }))
      ws.close()
    }
    ws.onerror = () => console.warn("No se detectó impresora local (WebSocket)")
  }

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">

      {/* HEADER */}
      <div className="mb-10 text-center flex flex-col items-center">
        {logoUrl && (
            <img 
                src={logoUrl} 
                alt="Logo Notaría" 
                className="h-24 w-auto object-contain mb-6 drop-shadow-2xl" 
            />
        )}
        <h1 className="text-4xl font-bold text-brand-500 mb-2">Bienvenido</h1>
        <p className="text-slate-400">Solicite su turno a continuación.</p>
      </div>

      {/* PASO 1: CÉDULA */}
      {step === 'cedula' && (
        <div className="w-full max-w-md animate-in fade-in zoom-in duration-300">
          <label className="block text-center text-xl mb-4">Ingrese su número de documento</label>
          <input
            type="text"
            readOnly
            value={cedula}
            className="w-full bg-slate-800 border-2 border-slate-600 rounded-xl p-4 text-center text-4xl font-mono tracking-widest focus:border-brand-500 outline-none mb-4"
            placeholder="Documento"
          />
          <VirtualKeyboard
            mode="numeric"
            onKeyPress={handleKeyPress}
            onDelete={handleDelete}
            onEnter={verificarCedula}
          />
          <button
            onClick={verificarCedula}
            disabled={loading}
            className="w-full mt-6 bg-brand-600 hover:bg-brand-500 p-4 rounded-xl text-xl font-bold shadow-lg shadow-brand-900/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" /> : "Continuar"}
          </button>
        </div>
      )}

      {/* PASO 2: NOMBRE (Solo si es nuevo) */}
      {step === 'nombre' && (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-right duration-300">
          <label className="block text-center text-xl mb-4">Ingrese su Nombre Completo</label>
          <input
            type="text"
            readOnly
            value={nombre}
            className="w-full bg-slate-800 border-2 border-slate-600 rounded-xl p-4 text-center text-3xl mb-4"
            placeholder="Su Nombre"
          />
          <VirtualKeyboard
            mode="qwerty"
            onKeyPress={handleKeyPress}
            onDelete={handleDelete}
            onEnter={() => setStep('servicios')}
          />
        </div>
      )}

      {/* PASO 3: SERVICIOS */}
      {step === 'servicios' && (
        <div className="w-full max-w-5xl animate-in fade-in zoom-in duration-300">
          <h2 className="text-3xl text-center mb-8">Hola <span className="text-brand-400 font-bold">{nombre}</span>, ¿qué trámite realizará?</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {servicios.map((serv) => (
              <button
                key={serv.id_servicio}
                onClick={() => registrarYPedirTurno(serv.id_servicio, serv.nombre_servicio)}
                disabled={loading}
                className="bg-slate-800 border border-slate-700 p-8 rounded-2xl hover:bg-brand-600 hover:border-blue-400 hover:-translate-y-1 transition-all shadow-xl group text-left relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <div className="text-6xl font-black">{serv.prefijo_ticket}</div>
                </div>
                <h3 className="text-2xl font-bold mb-2 group-hover:text-white">{serv.nombre_servicio}</h3>
                <p className="text-slate-400 group-hover:text-blue-100 text-sm">Toque para seleccionar</p>
              </button>
            ))}
          </div>

          <button onClick={() => setStep('cedula')} className="mt-10 mx-auto block text-slate-500 hover:text-white underline">
            Cancelar / Volver
          </button>
        </div>
      )}

      {/* PASO 4: ÉXITO / IMPRIMIENDO */}
      {step === 'exito' && (
        <div className="text-center animate-in fade-in zoom-in duration-500">
          <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/50">
            <Printer size={64} className="text-white" />
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">¡Turno Generado!</h2>
          <p className="text-slate-400 text-xl mb-8">Por favor retire su ticket impreso.</p>

          <div className="bg-white text-black p-6 rounded-xl w-64 mx-auto rotate-3 shadow-xl transform transition-transform hover:rotate-0">
            <div className="border-b-2 border-dashed border-gray-300 pb-4 mb-4">
              <p className="text-sm font-bold text-gray-500 uppercase">Su Turno</p>
              <p className="text-6xl font-black">{mensajeTicket}</p>
            </div>
            <p className="text-xs text-center text-gray-400">Gracias por su visita</p>
          </div>
        </div>
      )}

    </div>
  )
}