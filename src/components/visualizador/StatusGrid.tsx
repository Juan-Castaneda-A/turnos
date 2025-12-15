'use client'

import { Card } from "@/components/ui/card"

export default function StatusGrid({ modules }: { modules: any[] }) {
  // Calculamos columnas dinámicas según la cantidad para que se vea balanceado
  // Menos de 5 módulos = 2 columnas. Más de 5 = 3 o 4 columnas.
  const getGridClass = () => {
    const count = modules.length
    if (count <= 4) return "grid-cols-2 grid-rows-2" // Gigantes
    if (count <= 6) return "grid-cols-3 grid-rows-2" // Grandes
    if (count <= 8) return "grid-cols-4 grid-rows-2" // Medianas apaisadas
    if (count <= 12) return "grid-cols-4 grid-rows-3" // Estándar
    return "grid-cols-5 grid-rows-3" // Densas (para muchos módulos)
  }

  return (
    // h-full es clave: le dice que ocupe todo el espacio disponible que le da el padre
    <div className={`grid ${getGridClass()} gap-4 w-full h-full max-w-[90vw] p-4`}>
      {modules.map((mod) => {
        const activeTurn = mod.turnos?.find((t: any) => t.estado === 'en atencion')
        
        return (
          <Card 
            key={mod.id_modulo} 
            // Quitamos h-48. Ponemos h-full para que se estire
            className={`relative overflow-hidden border-2 flex flex-col items-center justify-center h-full shadow-2xl transition-all duration-500 ${
              activeTurn 
                ? 'bg-slate-800 border-yellow-500/50 shadow-yellow-900/20' 
                : 'bg-slate-900/50 border-slate-800 opacity-60'
            }`}
          >
            {/* Etiqueta del módulo */}
            <div className="absolute top-0 left-0 bg-slate-950 px-3 py-1 rounded-br-lg border-b border-r border-slate-800 text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
              {mod.nombre_modulo}
            </div>

            {/* Contenido (Escalable) */}
            {activeTurn ? (
              <div className="text-center animate-in zoom-in duration-300 flex flex-col items-center justify-center h-full">
                {/* Usamos view-port units (vmin) o porcentajes para el texto para que escale con la caja */}
                <p className="text-yellow-400 font-black text-4xl md:text-5xl lg:text-6xl tracking-tighter leading-none mb-2">
                  {activeTurn.prefijo_turno}-{String(activeTurn.numero_turno).padStart(3, '0')}
                </p>
                <span className="bg-yellow-500/10 text-yellow-200 px-3 py-0.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider border border-yellow-500/20">
                  Atendiendo
                </span>
              </div>
            ) : (
              <div className="text-slate-600 font-bold text-xl md:text-2xl uppercase tracking-widest flex items-center justify-center h-full">
                Disponible
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}