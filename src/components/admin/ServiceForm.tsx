'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
// Asegúrate de que tu action se llame 'createOrUpdateServiceAction' en actions/admin-services.ts
import { createOrUpdateServiceAction } from '@/actions/admin-services' 
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Recibimos initialData
export default function ServiceForm({ onSuccess, initialData }: { onSuccess: () => void, initialData?: any }) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const res = await createOrUpdateServiceAction(formData)
    
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
      {/* Si hay datos iniciales, ponemos el ID en un input oculto */}
      {initialData && <input type="hidden" name="id" value={initialData.id_servicio} />}

      <div>
        <label className="text-sm font-medium mb-1 block">Nombre del Servicio</label>
        <Input 
            name="nombre" 
            placeholder="Ej: Autenticación" 
            defaultValue={initialData?.nombre_servicio} // Rellena si existe
            required 
            className="bg-slate-800 border-slate-700" 
        />
      </div>
      
      <div>
        <label className="text-sm font-medium mb-1 block">Prefijo del Ticket</label>
        <Input 
          name="prefijo" 
          placeholder="Ej: A (para A-001)" 
          defaultValue={initialData?.prefijo_ticket} // Rellena si existe
          required 
          maxLength={3} 
          className="bg-slate-800 border-slate-700 uppercase placeholder:normal-case" 
        />
        <p className="text-xs text-slate-500 mt-1">Máximo 3 letras. Se usará en los tickets impresos.</p>
      </div>

      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 mt-4">
        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : (initialData ? 'Actualizar Servicio' : 'Guardar Servicio')}
      </Button>
    </form>
  )
}