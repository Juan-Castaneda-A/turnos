'use client'

import { useState } from 'react'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Trash2, UserPlus, MoreHorizontal, Pencil } from "lucide-react"
import { deleteUserAction } from '@/actions/admin-users'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import UserForm from './UserForm' // Ya lo crearemos

export default function UsersTable({ users, modules }: { users: any[], modules: any[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null) // <--- Estado para editar

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que deseas eliminar este usuario?')) return
    const res = await deleteUserAction(id)
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
  }

  const handleEdit = (user: any) => {
    setSelectedUser(user) // Guardamos el usuario a editar
    setIsOpen(true)       // Abrimos el modal
  }

  const handleCreate = () => {
    setSelectedUser(null) // Limpiamos para crear uno nuevo
    setIsOpen(true)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Gestión de Usuarios</h2>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-500 text-white">
              <UserPlus className="mr-2 h-4 w-4" /> Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 text-white border-slate-800">
            <DialogHeader>
              <DialogTitle>{selectedUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
            </DialogHeader>
            {/* Pasamos selectedUser como initialData */}
            <UserForm modules={modules} onSuccess={() => setIsOpen(false)} initialData={selectedUser} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-slate-900/50">
              <TableHead className="text-slate-400">Nombre</TableHead>
              <TableHead className="text-slate-400">Usuario</TableHead>
              <TableHead className="text-slate-400">Rol</TableHead>
              <TableHead className="text-slate-400">Módulo</TableHead>
              <TableHead className="text-right text-slate-400">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id_usuario} className="border-slate-800 hover:bg-slate-800/50">
                <TableCell className="font-medium text-slate-200">{user.nombre_completo}</TableCell>
                <TableCell>{user.nombre_usuario}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.rol === 'administrador' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {user.rol}
                  </span>
                </TableCell>
                <TableCell>{user.modulos?.nombre_modulo || '-'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(user)} className="text-blue-400 hover:bg-blue-950/50 hover:text-blue-300">
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id_usuario)} className="text-red-400 hover:bg-red-950/50 hover:text-red-300">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}