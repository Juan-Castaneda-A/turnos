'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { createOrUpdateMessageAction } from '@/actions/admin-messages'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function MessageForm({ onSuccess, initialData }: { onSuccess: () => void, initialData?: any }) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const res = await createOrUpdateMessageAction(formData)
    
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
      {initialData && <input type="hidden" name="id" value={initialData.id} />}
      
      <div>
        <label className="text-sm font-medium mb-1 block">Texto del Mensaje</label>
        <Input 
            name="texto" 
            placeholder="Ej: Recuerde traer su cédula original..." 
            defaultValue={initialData?.texto_mensaje} 
            required 
            className="bg-slate-800 border-slate-700" 
        />
      </div>

      {!initialData && (
        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <Switch name="activo" defaultChecked />
            <span className="text-sm font-medium">Mostrar inmediatamente</span>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 mt-4">
        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : (initialData ? 'Actualizar' : 'Guardar')}
      </Button>
    </form>
  )
}