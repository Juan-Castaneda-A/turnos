import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ClientTrackingView from '@/components/public/ClientTrackingView'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Esta página se genera en el servidor para SEO y velocidad
export default async function TrackingPage({ params }: { params: { id: string } }) {
  // Buscamos el turno por ID (o podrías usar un hash uuid si prefieres no exponer IDs secuenciales)
  const { data: turno } = await supabase
    .from('turnos')
    .select('*, modulos(nombre_modulo), servicios(nombre_servicio)')
    .eq('id_turno', params.id)
    .single()

  if (!turno) return notFound()

  return <ClientTrackingView initialTurno={turno} />
}