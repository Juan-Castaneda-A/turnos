'use client'

import { Card } from "@/components/ui/card"

export default function StatusGrid({ modules }: { modules: any[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-10 w-full max-w-7xl">
      {modules.map((mod) => {
        const activeTurn = mod.turnos?.find((t: any) => t.estado === 'en atencion')
        
        return (
          <Card 
            key={mod.id_modulo} 
            className={`relative overflow-hidden border-2 flex flex-col items-center justify-center h-48 shadow-2xl transition-all duration-500 ${
              activeTurn 
                ? 'bg-slate-800 border-yellow-500/50 shadow-yellow-900/20' 
                : 'bg-slate-900/50 border-slate-800 opacity-70'
            }`}
          >
            <div className="absolute top-0 left-0 bg-slate-950 px-4 py-1 rounded-br-lg border-b border-r border-slate-800 text-xs font-bold text-slate-400 uppercase">
              {mod.nombre_modulo}
            </div>

            {activeTurn ? (
              <div className="text-center animate-in zoom-in duration-300">
                <p className="text-yellow-400 font-black text-5xl tracking-tighter mb-2">
                  {activeTurn.prefijo_turno}-{String(activeTurn.numero_turno).padStart(3, '0')}
                </p>
                <span className="bg-yellow-500/10 text-yellow-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-yellow-500/20">
                  Atendiendo
                </span>
              </div>
            ) : (
              <div className="text-slate-600 font-bold text-2xl uppercase tracking-widest">
                Disponible
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}