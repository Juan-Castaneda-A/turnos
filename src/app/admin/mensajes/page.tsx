import { createClient } from '@supabase/supabase-js'
import MessagesTable from '@/components/admin/MessagesTable'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function MensajesPage() {
  // Ordenamos por los más recientes primero
  const { data: messages } = await supabase
    .from('mensajes_visualizador')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <MessagesTable messages={messages || []} />
    </div>
  )
}