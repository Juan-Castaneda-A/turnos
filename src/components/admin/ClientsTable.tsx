'use client'

import { useState, useEffect } from 'react'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClientsAction } from '@/actions/admin-clients'
import { Loader2, Search, ChevronLeft, ChevronRight, User } from 'lucide-react'

export default function ClientsTable() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)

  // Función de carga
  const fetchData = async () => {
    setLoading(true)
    const res = await getClientsAction(search, page)
    setLoading(false)
    
    if (res.success) {
      setData(res.data)
      setTotalPages(res.totalPages)
      setTotalRecords(res.total)
    }
  }

  // Efecto: Cargar cuando cambia página
  useEffect(() => {
    fetchData()
  }, [page])

  // Efecto: Buscar cuando el usuario deja de escribir (Debounce 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1) // Resetear a página 1 al buscar
      fetchData()
    }, 500) // Espera 0.5s

    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="space-y-6">
      
      {/* BARRA DE BÚSQUEDA */}
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Buscar por cédula o nombre..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
          />
        </div>
        <div className="text-sm text-slate-400">
            Total: <span className="font-bold text-white">{totalRecords}</span> clientes
        </div>
      </div>

      {/* TABLA */}
      <div className="rounded-md border border-slate-800 bg-slate-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-slate-900/50">
              <TableHead className="text-slate-400">Nombre Completo</TableHead>
              <TableHead className="text-slate-400">Identificación</TableHead>
              <TableHead className="text-right text-slate-400">Fecha Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-blue-500" /></TableCell></TableRow>
            ) : data.length === 0 ? (
               <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-8">No se encontraron clientes.</TableCell></TableRow>
            ) : (
                data.map((client) => (
                  <TableRow key={client.id_cliente} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="font-medium text-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                <User className="h-4 w-4" />
                            </div>
                            {client.nombre_completo}
                        </div>
                    </TableCell>
                    <TableCell className="font-mono text-blue-300">
                        {client.numero_identificacion}
                    </TableCell>
                    <TableCell className="text-right text-slate-500 text-xs">
                        {new Date(client.creado_en).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINACIÓN */}
      <div className="flex justify-end gap-2">
        <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
        >
            <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <div className="flex items-center px-4 text-sm font-medium text-slate-400 bg-slate-900 border border-slate-800 rounded-md">
            Página {page} de {totalPages || 1}
        </div>
        <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
        >
            Siguiente <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

    </div>
  )
}