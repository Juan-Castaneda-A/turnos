import ReportsView from '@/components/admin/ReportsView'

export default function ReportesPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white">Reportes y Estadísticas</h2>
        <p className="text-slate-400 mt-1">Analice el rendimiento de la notaría.</p>
      </div>
      
      <ReportsView />
    </div>
  )
}