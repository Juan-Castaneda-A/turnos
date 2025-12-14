'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function Ticker() {
  const [messages, setMessages] = useState<string[]>([])
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('mensajes_visualizador')
        .select('texto_mensaje')
        .eq('is_active', true)
      
      if (data) setMessages(data.map(m => m.texto_mensaje))
    }

    fetchMessages()
    
    // Escuchar cambios en mensajes en tiempo real
    const channel = supabase.channel('ticker_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_visualizador' }, fetchMessages)
        .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (messages.length === 0) return null

  const fullText = messages.join("  •  ") + "  •  "

  return (
    <div className="fixed bottom-0 w-full bg-blue-900/90 border-t border-blue-800 text-white py-3 overflow-hidden z-50">
      <div className="whitespace-nowrap animate-marquee flex gap-4">
        {/* Duplicamos el texto para efecto infinito */}
        <span className="text-xl font-medium tracking-wide mx-4">{fullText}</span>
        <span className="text-xl font-medium tracking-wide mx-4">{fullText}</span>
        <span className="text-xl font-medium tracking-wide mx-4">{fullText}</span>
      </div>
      
      {/* Estilo inline para la animación (o agrégalo a tu globals.css) */}
      <style jsx>{`
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}