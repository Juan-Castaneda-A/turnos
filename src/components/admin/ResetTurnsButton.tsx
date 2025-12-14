'use client'

import { useState } from 'react'
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2, AlertTriangle } from "lucide-react"
import { resetDailyTurnsAction } from '@/actions/admin-settings'
import { toast } from 'sonner'

export default function ResetTurnsButton() {
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    setLoading(true)
    const res = await resetDailyTurnsAction()
    setLoading(false)

    if (res.success) {
      toast.success(res.message)
    } else {
      toast.error(res.message)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white font-bold w-full sm:w-auto">
          <Trash2 className="mr-2 h-4 w-4" />
          Resetear Turnos del Día
        </Button>
      </AlertDialogTrigger>
      
      <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            ¿Estás absolutamente seguro?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            Esta acción eliminará <strong>TODOS los turnos</strong> actuales de la base de datos. 
            El contador volverá a iniciar en 001. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleReset} 
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white border-none"
          >
            {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            Sí, Eliminar Todo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}