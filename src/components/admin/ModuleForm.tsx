'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { createOrUpdateModuleAction } from '@/actions/admin-modules'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function ModuleForm({ onSuccess, initialData }: { onSuccess: () => void, initialData?: any }) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const res = await createOrUpdateModuleAction(formData)
    
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
      {initialData && <input type="hidden" name="id" value={initialData.id_modulo} />}
      
      <div>
        <label className="text-sm font-medium mb-1 block">Nombre</label>
        <Input name="nombre" defaultValue={initialData?.nombre_modulo} required className="bg-slate-800 border-slate-700" />
      </div>
      
      <div>
        <label className="text-sm font-medium mb-1 block">Descripción</label>
        <Textarea name="descripcion" defaultValue={initialData?.descripcion} className="bg-slate-800 border-slate-700" />
      </div>

      {/* Solo mostramos el switch de estado al CREAR. Al editar se hace desde la tabla */}
      {!initialData && (
        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <Switch name="estado" defaultChecked />
            <span className="text-sm font-medium">Estado Inicial: Activo</span>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 mt-4">
        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : (initialData ? 'Actualizar' : 'Guardar')}
      </Button>
    </form>
  )
}