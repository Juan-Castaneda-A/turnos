'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollText, Clock } from "lucide-react"
import { format } from "date-fns" // Asegúrate de tener date-fns o usa JS nativo 

export default function TurnLogs({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) return <span className="text-slate-600 text-xs">Sin logs</span>

  // Ordenar logs cronológicamente
  const sortedLogs = [...logs].sort((a, b) => new Date(a.hora_accion).getTime() - new Date(b.hora_accion).getTime())

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300">
          <ScrollText className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-slate-900 border-slate-800 text-white p-0">
        <div className="p-3 border-b border-slate-800 font-semibold bg-slate-950/50">
          Historial de Acciones
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
          {sortedLogs.map((log, i) => (
            <div key={i} className="flex items-start gap-3 text-sm p-2 rounded hover:bg-slate-800/50">
              <Clock className="h-4 w-4 text-slate-500 mt-0.5" />
              <div>
                <p className="font-medium capitalize text-slate-200">{log.accion}</p>
                <p className="text-xs text-slate-500">
                  {new Date(log.hora_accion).toLocaleString('es-CO')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}