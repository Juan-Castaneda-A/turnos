import { createClient } from '@supabase/supabase-js'
import ModulesTable from '@/components/admin/ModulesTable'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function ModulosPage() {
  const { data: modules } = await supabase
    .from('modulos')
    .select('*')
    .order('nombre_modulo', { ascending: true })

  return (
    <div className="space-y-6">
      <ModulesTable modules={modules || []} />
    </div>
  )
}