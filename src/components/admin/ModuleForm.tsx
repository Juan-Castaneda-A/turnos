'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { createModuleAction } from '@/actions/admin-modules'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function ModuleForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const res = await createModuleAction(formData)
    
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
      <div>
        <label className="text-sm font-medium mb-1 block">Nombre del Módulo</label>
        <Input name="nombre" placeholder="Ej: Módulo 01" required className="bg-slate-800 border-slate-700" />
      </div>
      
      <div>
        <label className="text-sm font-medium mb-1 block">Descripción (Opcional)</label>
        <Textarea name="descripcion" placeholder="Para trámites de..." className="bg-slate-800 border-slate-700" />
      </div>

      <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <Switch name="estado" defaultChecked />
        <span className="text-sm font-medium">Estado Inicial: Activo</span>
      </div>

      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 mt-4">
        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Guardar Módulo'}
      </Button>
    </form>
  )
}