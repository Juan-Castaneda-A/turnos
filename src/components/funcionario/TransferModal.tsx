'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from '@supabase/ssr'
import { transferTurnAction } from '@/actions/funcionario-actions'
import { toast } from 'sonner'
import { Loader2, ArrowRightLeft } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  turnId: number | null
  currentModuleId: number
}

export default function TransferModal({ isOpen, onClose, turnId, currentModuleId }: Props) {
  const [modules, setModules] = useState<any[]>([])
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Cargar módulos disponibles (excluyendo el mío)
  useEffect(() => {
    if (isOpen) {
      const load = async () => {
        const { data } = await supabase.from('modulos').select('*').eq('estado', 'activo').neq('id_modulo', currentModuleId)
        if (data) setModules(data)
      }
      load()
    }
  }, [isOpen, currentModuleId, supabase])

  const handleTransfer = async () => {
    if (!turnId || !target) return
    setLoading(true)
    const res = await transferTurnAction(turnId, parseInt(target))
    setLoading(false)

    if (res.success) {
      toast.success(res.message)
      onClose()
    } else {
      toast.error(res.message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ArrowRightLeft className="text-blue-400" /> Transferir Turno
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-400">Seleccione el módulo al que desea enviar este turno.</p>
          <Select onValueChange={setTarget}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Seleccionar Módulo..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              {modules.map(m => (
                <SelectItem key={m.id_modulo} value={String(m.id_modulo)}>{m.nombre_modulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800">
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={!target || loading} className="bg-blue-600 hover:bg-blue-500 text-white">
            {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : null}
            Confirmar Transferencia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}