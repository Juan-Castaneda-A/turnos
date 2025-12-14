'use client'

import { useState } from 'react'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus, Pencil, MessageSquare } from "lucide-react"
import { deleteMessageAction, toggleMessageStatusAction } from '@/actions/admin-messages'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import MessageForm from './MessageForm'

export default function MessagesTable({ messages }: { messages: any[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMsg, setSelectedMsg] = useState<any>(null)

  const handleCreate = () => {
    setSelectedMsg(null)
    setIsOpen(true)
  }

  const handleEdit = (msg: any) => {
    setSelectedMsg(msg)
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este mensaje?')) return
    const res = await deleteMessageAction(id)
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
  }

  const handleToggle = async (id: number, currentStatus: boolean) => {
    const res = await toggleMessageStatusAction(id, !currentStatus)
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Mensajes del Visualizador (Ticker)</h2>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-500 text-white">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Mensaje
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 text-white border-slate-800">
            <DialogHeader>
              <DialogTitle>{selectedMsg ? 'Editar Mensaje' : 'Crear Mensaje'}</DialogTitle>
            </DialogHeader>
            <MessageForm onSuccess={() => setIsOpen(false)} initialData={selectedMsg} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-slate-900/50">
              <TableHead className="text-slate-400">Mensaje</TableHead>
              <TableHead className="text-slate-400 w-[150px]">Estado</TableHead>
              <TableHead className="text-right text-slate-400 w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.map((msg) => (
              <TableRow key={msg.id} className="border-slate-800 hover:bg-slate-800/50">
                <TableCell className="font-medium text-slate-200">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        {msg.texto_mensaje}
                    </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={msg.is_active}
                      onCheckedChange={() => handleToggle(msg.id, msg.is_active)}
                    />
                    <span className={`text-xs ${msg.is_active ? 'text-green-400' : 'text-slate-500'}`}>
                      {msg.is_active ? 'Visible' : 'Oculto'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(msg)} className="text-blue-400 hover:bg-blue-950/50 hover:text-blue-300">
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(msg.id)} className="text-red-400 hover:bg-red-950/50 hover:text-red-300">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {messages.length === 0 && (
                <TableRow>
                    <TableCell colSpan={3} className="text-center text-slate-500 py-8">No hay mensajes configurados.</TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}