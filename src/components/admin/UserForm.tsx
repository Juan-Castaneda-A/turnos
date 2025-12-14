'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createOrUpdateUserAction } from '@/actions/admin-users' // <--- Nota el cambio de nombre
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Recibimos initialData opcional
export default function UserForm({ modules, onSuccess, initialData }: { modules: any[], onSuccess: () => void, initialData?: any }) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const res = await createOrUpdateUserAction(formData)
    
    setLoading(false)
    if (res.success) {
      toast.success(res.message)
      onSuccess()
    } else {
      toast.error(res.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      {/* Input oculto para el ID si estamos editando */}
      {initialData && <input type="hidden" name="id" value={initialData.id_usuario} />}

      <div>
        <label className="text-sm font-medium mb-1 block">Nombre Completo</label>
        <Input name="nombre" defaultValue={initialData?.nombre_completo} placeholder="Ej: Pepito Pérez" required className="bg-slate-800 border-slate-700" />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Usuario</label>
          <Input name="usuario" defaultValue={initialData?.nombre_usuario} placeholder="pepito" required className="bg-slate-800 border-slate-700" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Contraseña</label>
          {/* La contraseña solo es required si NO hay initialData (es decir, si es nuevo) */}
          <Input name="password" type="password" placeholder="******" required={!initialData} className="bg-slate-800 border-slate-700" />
          {initialData && <p className="text-[10px] text-slate-500 mt-1">Dejar en blanco para mantener la actual.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Rol</label>
          <select name="rol" defaultValue={initialData?.rol} className="w-full h-10 rounded-md border border-slate-700 bg-slate-800 px-3 text-sm">
            <option value="funcionario">Funcionario</option>
            <option value="administrador">Administrador</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Módulo Asignado</label>
          <select name="modulo" defaultValue={initialData?.id_modulo_asignado || ""} className="w-full h-10 rounded-md border border-slate-700 bg-slate-800 px-3 text-sm">
            <option value="">Ninguno</option>
            {modules.map(m => (
              <option key={m.id_modulo} value={m.id_modulo}>{m.nombre_modulo}</option>
            ))}
          </select>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 mt-4">
        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : (initialData ? 'Actualizar Usuario' : 'Crear Usuario')}
      </Button>
    </form>
  )
}