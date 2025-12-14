'use client'

import { useState } from 'react'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus } from "lucide-react"
import { deleteModuleAction, toggleModuleStatusAction } from '@/actions/admin-modules'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import ModuleForm from './ModuleForm'

export default function ModulesTable({ modules }: { modules: any[] }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar módulo? Esto podría fallar si tiene historial.')) return
    const res = await deleteModuleAction(id)
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
  }

  const handleToggle = async (id: number, currentState: string) => {
    const newState = currentState !== 'activo' // Invertir
    const res = await toggleModuleStatusAction(id, newState)
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Gestión de Módulos</h2>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500 text-white">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Módulo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 text-white border-slate-800">
            <DialogHeader>
              <DialogTitle>Crear Módulo</DialogTitle>
            </DialogHeader>
            <ModuleForm onSuccess={() => setIsOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-slate-900/50">
              <TableHead className="text-slate-400">Nombre</TableHead>
              <TableHead className="text-slate-400">Descripción</TableHead>
              <TableHead className="text-slate-400">Estado</TableHead>
              <TableHead className="text-right text-slate-400">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((mod) => (
              <TableRow key={mod.id_modulo} className="border-slate-800 hover:bg-slate-800/50">
                <TableCell className="font-medium text-slate-200">{mod.nombre_modulo}</TableCell>
                <TableCell className="text-slate-500">{mod.descripcion || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={mod.estado === 'activo'}
                      onCheckedChange={() => handleToggle(mod.id_modulo, mod.estado)}
                    />
                    <span className={`text-xs ${mod.estado === 'activo' ? 'text-green-400' : 'text-slate-500'}`}>
                      {mod.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(mod.id_modulo)} className="text-red-400 hover:bg-red-950/50 hover:text-red-300">
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