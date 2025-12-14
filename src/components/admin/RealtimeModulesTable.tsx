'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function RealtimeModulesTable() {
  const [modules, setModules] = useState<any[]>([])
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchData = async () => {
    // Traemos módulos y su turno activo (si tiene)
    const { data } = await supabase
        .from('modulos')
        .select(`
            *, 
            turnos!turnos_id_modulo_atencion_fkey(prefijo_turno, numero_turno, estado)
        `)
        .eq('estado', 'activo')
        .order('nombre_modulo')
    
    if (data) setModules(data)
  }

  useEffect(() => {
    fetchData()
    const channel = supabase.channel('admin_dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'modulos' }, fetchData)
        .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <Table>
            <TableHeader className="bg-slate-900">
                <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400">Módulo</TableHead>
                    <TableHead className="text-slate-400">Estado</TableHead>
                    <TableHead className="text-slate-400">Turno Actual</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {modules.map(mod => {
                    // Filtrar solo el turno "en atencion" de la lista de turnos de ese modulo
                    const activeTurn = mod.turnos.find((t: any) => t.estado === 'en atencion')
                    
                    return (
                        <TableRow key={mod.id_modulo} className="border-slate-800">
                            <TableCell className="font-medium text-white">{mod.nombre_modulo}</TableCell>
                            <TableCell>
                                <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-500/20">
                                    Activo
                                </span>
                            </TableCell>
                            <TableCell>
                                {activeTurn ? (
                                    <span className="text-yellow-400 font-bold">
                                        {activeTurn.prefijo_turno}-{String(activeTurn.numero_turno).padStart(3,'0')}
                                    </span>
                                ) : (
                                    <span className="text-slate-600">Libre</span>
                                )}
                            </TableCell>
                        </TableRow>
                    )
                })}
                {modules.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-slate-500">Cargando...</TableCell></TableRow>
                )}
            </TableBody>
        </Table>
    </div>
  )
}