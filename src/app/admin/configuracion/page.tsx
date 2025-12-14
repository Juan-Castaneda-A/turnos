import ResetTurnsButton from '@/components/admin/ResetTurnsButton'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { ShieldAlert, Settings2 } from 'lucide-react'

export default function ConfiguracionPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold text-white">Configuración del Sistema</h2>
        <p className="text-slate-400 mt-1">Opciones generales y mantenimiento.</p>
      </div>

      {/* ZONA DE PELIGRO */}
      <Card className="border-red-900/50 bg-red-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <ShieldAlert className="h-5 w-5" />
            Zona de Peligro
          </CardTitle>
          <CardDescription className="text-red-200/50">
            Acciones destructivas que afectan la operación actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-red-900/30 bg-red-900/20">
            <div>
              <h4 className="font-semibold text-red-200">Resetear Numeración</h4>
              <p className="text-sm text-red-300/70">
                Elimina todos los turnos en espera y atendidos. Úselo al inicio del día.
              </p>
            </div>
            <ResetTurnsButton />
          </div>
        </CardContent>
      </Card>

      {/* OTRAS CONFIGURACIONES (Placeholder para el futuro) */}
      <Card className="border-slate-800 bg-slate-900/50 opacity-75">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Settings2 className="h-5 w-5" />
            Parámetros Generales
          </CardTitle>
          <CardDescription>Configuraciones de la notaría (Próximamente)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 border border-slate-800 rounded text-sm text-slate-500">
                <span>Horario de Atención</span>
                <span className="font-mono">08:00 - 18:00</span>
            </div>
            <div className="flex justify-between items-center p-3 border border-slate-800 rounded text-sm text-slate-500">
                <span>Mensaje del Ticket</span>
                <span>"Gracias por su visita"</span>
            </div>
        </CardContent>
      </Card>
    </div>
  )
}