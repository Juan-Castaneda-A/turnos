import ClientsTable from '@/components/admin/ClientsTable'

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Base de Clientes</h2>
        <p className="text-slate-400 mt-1">Directorio de personas registradas en el kiosco.</p>
      </div>
      
      <ClientsTable />
    </div>
  )
}