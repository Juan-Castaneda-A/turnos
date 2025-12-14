'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Megaphone } from 'lucide-react'
import { toast } from 'sonner'

export default function SilenceButton() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const sendSilence = async () => {
    await supabase.channel('turnos_channel').send({
        type: 'broadcast',
        event: 'silence_alert',
        payload: { message: 'Silencio' }
    })
    toast.success("Alerta de silencio enviada")
  }

  return (
    <Button onClick={sendSilence} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold shadow-lg shadow-yellow-900/20">
      <Megaphone className="mr-2 h-4 w-4" />
      Pedir Silencio
    </Button>
  )
}