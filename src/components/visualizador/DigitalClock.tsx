'use client'

import { useState, useEffect } from 'react'

export default function DigitalClock() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    // Establecer hora inicial solo en el cliente
    setTime(new Date())

    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  if (!time) return null // No renderizar nada en el servidor

  return (
    <div className="flex flex-col items-end text-right animate-in fade-in duration-1000">
      <div className="text-4xl font-black text-white tabular-nums tracking-wider drop-shadow-lg">
        {time.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
      </div>
      <div className="text-sm font-medium text-slate-300 uppercase tracking-widest">
        {time.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
    </div>
  )
}