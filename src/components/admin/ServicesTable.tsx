'use client'

import { useState } from 'react'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Trash2, Plus, Tag } from "lucide-react"
import { deleteServiceAction } from '@/actions/admin-services'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import ServiceForm from './ServiceForm'

export default function ServicesTable({ services }: { services: any[] }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que deseas eliminar este servicio?')) return
    const res = await deleteServiceAction(id)
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Gestión de Servicios</h2>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500 text-white">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Servicio
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 text-white border-slate-800">
            <DialogHeader>
              <DialogTitle>Crear Servicio</DialogTitle>
            </DialogHeader>
            <ServiceForm onSuccess={() => setIsOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-slate-900/50">
              <TableHead className="text-slate-400">Nombre</TableHead>
              <TableHead className="text-slate-400">Prefijo</TableHead>
              <TableHead className="text-right text-slate-400">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id_servicio} className="border-slate-800 hover:bg-slate-800/50">
                <TableCell className="font-medium text-slate-200">
                    <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-blue-400" />
                        {service.nombre_servicio}
                    </div>
                </TableCell>
                <TableCell>
                    <span className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-xs font-mono font-bold text-yellow-400">
                        {service.prefijo_ticket}
                    </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id_servicio)} className="text-red-400 hover:bg-red-950/50 hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}