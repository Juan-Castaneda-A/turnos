'use client'

import { useState } from 'react'
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from 'sonner'
import { toggleAssignmentAction } from '@/actions/admin-assignments'
import { Loader2 } from 'lucide-react'

type Props = {
  modules: any[]
  services: any[]
  assignments: any[] // Lista plana de relaciones {id_modulo, id_servicio}
}

export default function AssignmentsMatrix({ modules, services, assignments }: Props) {
  // Convertimos la lista plana a un Mapa o Set para búsqueda rápida O(1)
  // Clave: "moduloID-servicioID"
  const [activePairs, setActivePairs] = useState<Set<string>>(() => {
    const set = new Set<string>()
    assignments.forEach(a => set.add(`${a.id_modulo}-${a.id_servicio}`))
    return set
  })

  const [loadingPair, setLoadingPair] = useState<string | null>(null)

  const handleToggle = async (moduleId: number, serviceId: number) => {
    const pairKey = `${moduleId}-${serviceId}`
    const isCurrentlyActive = activePairs.has(pairKey)
    const newState = !isCurrentlyActive

    setLoadingPair(pairKey) // Mostrar spinner en este checkbox específico

    // 1. Actualización Optimista (UI responde de inmediato)
    const newSet = new Set(activePairs)
    if (newState) newSet.add(pairKey)
    else newSet.delete(pairKey)
    setActivePairs(newSet)

    // 2. Llamada al Servidor
    const res = await toggleAssignmentAction(moduleId, serviceId, newState)

    setLoadingPair(null)

    if (!res.success) {
      // Si falla, revertimos el cambio visual
      toast.error("Error al guardar asignación")
      setActivePairs(prev => {
        const revertSet = new Set(prev)
        if (newState) revertSet.delete(pairKey)
        else revertSet.add(pairKey)
        return revertSet
      })
    } else {
        // Opcional: toast.success("Guardado") para no saturar
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-medium border-b border-r border-slate-800 sticky left-0 bg-slate-900 z-10">
                Módulos \ Servicios
              </th>
              {services.map(service => (
                <th key={service.id_servicio} className="px-6 py-4 font-medium border-b border-slate-800 text-center min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>{service.nombre_servicio}</span>
                    <span className="text-[10px] bg-slate-800 px-1.5 rounded text-slate-500 border border-slate-700">
                        {service.prefijo_ticket}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {modules.map(mod => (
              <tr key={mod.id_modulo} className="hover:bg-slate-800/30 transition-colors">
                {/* Nombre del Módulo (Fila Header) */}
                <td className="px-6 py-4 font-medium text-slate-200 border-r border-slate-800 sticky left-0 bg-slate-950/90 z-10">
                  {mod.nombre_modulo}
                </td>

                {/* Checkboxes */}
                {services.map(service => {
                  const pairKey = `${mod.id_modulo}-${service.id_servicio}`
                  const isLoading = loadingPair === pairKey
                  const isChecked = activePairs.has(pairKey)

                  return (
                    <td key={service.id_servicio} className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center h-6">
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        ) : (
                            <Checkbox 
                                checked={isChecked}
                                onCheckedChange={() => handleToggle(mod.id_modulo, service.id_servicio)}
                                className="data-[state=checked]:bg-blue-600 border-slate-600"
                            />
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {modules.length === 0 && (
        <div className="p-8 text-center text-slate-500">
            No hay módulos activos. Crea uno primero.
        </div>
      )}
    </div>
  )
}