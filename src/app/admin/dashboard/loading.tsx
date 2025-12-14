import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-9 w-64 mb-2 bg-slate-800" /> {/* Título */}
          <Skeleton className="h-4 w-48 bg-slate-800" /> {/* Subtítulo */}
        </div>
        <Skeleton className="h-10 w-32 bg-slate-800" /> {/* Botón Silencio */}
      </div>

      {/* Grid de KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="flex justify-between mb-2">
                <Skeleton className="h-4 w-20 bg-slate-800" />
                <Skeleton className="h-4 w-4 bg-slate-800" />
            </div>
            <Skeleton className="h-8 w-16 bg-slate-800 mb-1" />
            <Skeleton className="h-3 w-24 bg-slate-800" />
          </div>
        ))}
      </div>

      {/* Tabla Realtime */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40 bg-slate-800" />
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-slate-800" />
            ))}
        </div>
      </div>
    </div>
  )
}