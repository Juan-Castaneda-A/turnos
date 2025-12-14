import { createClient } from '@supabase/supabase-js'
import ServicesTable from '@/components/admin/ServicesTable'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function ServiciosPage() {
  const { data: services } = await supabase
    .from('servicios')
    .select('*')
    .order('nombre_servicio', { ascending: true })

  return (
    <div className="space-y-6">
      <ServicesTable services={services || []} />
    </div>
  )
}