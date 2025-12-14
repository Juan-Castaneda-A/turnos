'use client'

import { useState } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUp, ArrowDown, AlertCircle } from 'lucide-react'
import { updateModuleServicePriorityAction } from '@/actions/admin-priorities'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Props {
  modules: any[]
  assignments: any[] // Datos de modulos_servicios con el nombre del servicio
}

export default function PriorityManager({ modules, assignments }: Props) {
  const [selectedModule, setSelectedModule] = useState<string>('')
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const router = useRouter()

  // Filtrar asignaciones por el módulo seleccionado
  const currentServices = assignments
    .filter(a => a.id_modulo === parseInt(selectedModule))
    // Ordenar: Menor número = Mayor prioridad
    .sort((a, b) => (a.prioridad || 99) - (b.prioridad || 99))

  const changePriority = async (id_servicio: number, current: number, change: number) => {
    // Restamos porque 1 es más importante que 10
    // Si change es -1 (Subir visualmente), restamos al valor numérico
    const newPriority = current - change 
    if (newPriority < 1) return 

    setLoadingId(id_servicio)
    const res = await updateModuleServicePriorityAction(parseInt(selectedModule), id_servicio, newPriority)
    setLoadingId(null)

    if (res.success) {
      toast.success("Prioridad actualizada")
      router.refresh()
    } else {
      toast.error("Error al actualizar")
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      
      {/* SELECTOR DE MÓDULO */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <label className="text-sm font-medium text-slate-400 mb-2 block">
            Seleccione el módulo a configurar:
        </label>
        <Select onValueChange={setSelectedModule} value={selectedModule}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Seleccionar Módulo..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                {modules.map(m => (
                    <SelectItem key={m.id_modulo} value={String(m.id_modulo)}>
                        {m.nombre_modulo}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>

      {/* LISTA DE PRIORIDADES */}
      {selectedModule && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-xl flex items-start gap-3 text-blue-200 text-sm">
                <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <p>
                    Los servicios <strong>arriba</strong> en la lista serán atendidos primero por este módulo.
                    Use las flechas para reordenar la importancia.
                </p>
            </div>

            {currentServices.length === 0 ? (
                <div className="text-center p-10 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                    Este módulo no tiene servicios asignados. Ve a "Asignaciones" primero.
                </div>
            ) : (
                currentServices.map((item, index) => (
                    <Card key={item.id} className="bg-slate-900 border-slate-800 p-4 flex items-center justify-between group hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center bg-slate-800 w-10 h-10 rounded-full border border-slate-700 font-mono text-slate-400 text-sm">
                                #{index + 1}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-200 text-lg">
                                    {item.servicios?.nombre_servicio}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] uppercase font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                                        Nivel Prio: {item.prioridad}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => changePriority(item.id_servicio, item.prioridad, 1)} // 1 = Subir (restar valor)
                                disabled={loadingId === item.id_servicio || item.prioridad <= 1}
                                className="text-slate-400 hover:text-green-400 hover:bg-green-950/30"
                                title="Subir Prioridad"
                            >
                                <ArrowUp className="h-5 w-5" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => changePriority(item.id_servicio, item.prioridad, -1)} // -1 = Bajar (sumar valor)
                                disabled={loadingId === item.id_servicio}
                                className="text-slate-400 hover:text-red-400 hover:bg-red-950/30"
                                title="Bajar Prioridad"
                            >
                                <ArrowDown className="h-5 w-5" />
                            </Button>
                        </div>
                    </Card>
                ))
            )}
        </div>
      )}
    </div>
  )
}