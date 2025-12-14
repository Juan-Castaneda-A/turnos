'use client'

import { useState, useEffect } from 'react'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getTurnHistoryAction } from '@/actions/admin-history'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import TurnLogs from './TurnLogs'

export default function HistoryTable({ services }: { services: any[] }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  
  // Filtros
  const [page, setPage] = useState(1)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedService, setSelectedService] = useState('all')

  const fetchData = async () => {
    setLoading(true)
    const res = await getTurnHistoryAction({
      startDate,
      endDate,
      serviceId: selectedService,
      page,
      pageSize: 20
    })
    setLoading(false)

    if (res.success) {
      setData(res.data)
      setTotal(res.total)
    } else {
      toast.error("Error cargando historial")
    }
  }

  // Cargar al inicio y cuando cambie la página
  useEffect(() => {
    fetchData()
  }, [page]) // Solo dependencia de página para navegación

  // Manejar búsqueda (resetear a página 1)
  const handleSearch = () => {
    setPage(1)
    fetchData()
  }

  const totalPages = Math.ceil(total / 20)

  // Formatear hora
  const fmtTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'

  return (
    <div className="space-y-6">
      
      {/* BARRA DE FILTROS */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end">
        <div className="w-full md:w-auto">
          <label className="text-xs text-slate-400 mb-1 block">Desde</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="w-full md:w-auto">
          <label className="text-xs text-slate-400 mb-1 block">Hasta</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="w-full md:w-[200px]">
          <label className="text-xs text-slate-400 mb-1 block">Servicio</label>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              <SelectItem value="all">Todos los Servicios</SelectItem>
              {services.map(s => (
                <SelectItem key={s.id_servicio} value={String(s.id_servicio)}>{s.nombre_servicio}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white w-full md:w-auto">
          {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
          Filtrar
        </Button>
      </div>

      {/* TABLA DE DATOS */}
      <div className="rounded-md border border-slate-800 bg-slate-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-slate-900/50">
              <TableHead className="text-slate-400">Turno</TableHead>
              <TableHead className="text-slate-400">Servicio</TableHead>
              <TableHead className="text-slate-400">Estado</TableHead>
              <TableHead className="text-slate-400">Módulo</TableHead>
              <TableHead className="text-slate-400">Solicitud</TableHead>
              <TableHead className="text-slate-400">Llamado</TableHead>
              <TableHead className="text-slate-400">Fin</TableHead>
              <TableHead className="text-right text-slate-400">Logs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow>
                 <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />
                    Cargando datos...
                 </TableCell>
               </TableRow>
            ) : data.length === 0 ? (
               <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No se encontraron turnos.</TableCell></TableRow>
            ) : (
                data.map((turn) => (
                  <TableRow key={turn.id_turno} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="font-mono font-bold text-white">
                      {turn.prefijo_turno}-{String(turn.numero_turno).padStart(3, '0')}
                    </TableCell>
                    <TableCell className="text-slate-300">{turn.servicios?.nombre_servicio || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={turn.estado} />
                    </TableCell>
                    <TableCell className="text-slate-300">{turn.modulos?.nombre_modulo || '-'}</TableCell>
                    <TableCell className="text-slate-400 text-xs">{fmtTime(turn.hora_solicitud)}</TableCell>
                    <TableCell className="text-slate-400 text-xs">{fmtTime(turn.hora_llamado)}</TableCell>
                    <TableCell className="text-slate-400 text-xs">{fmtTime(turn.hora_finalizacion)}</TableCell>
                    <TableCell className="text-right">
                      <TurnLogs logs={turn.logs_turnos} />
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINACIÓN */}
      <div className="flex justify-between items-center px-2">
        <p className="text-sm text-slate-500">
            Mostrando {data.length} de {total} resultados
        </p>
        <div className="flex gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center text-sm text-slate-400 px-2">
                Pág {page} de {totalPages || 1}
            </span>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </div>

    </div>
  )
}

// Componente pequeño para el badge de estado
function StatusBadge({ status }: { status: string }) {
    const colors: any = {
        'en espera': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        'en atencion': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        'atendido': 'bg-green-500/10 text-green-400 border-green-500/20',
        'cancelado': 'bg-red-500/10 text-red-400 border-red-500/20'
    }
    const colorClass = colors[status] || 'bg-slate-500/10 text-slate-400'
    
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider ${colorClass}`}>
            {status}
        </span>
    )
}