'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudRain, Sun, CloudLightning, Snowflake, Thermometer } from 'lucide-react'

// Coordenadas por defecto (Ej: Valledupar, Colombia). 
// Puedes cambiarlas por las de tu ciudad exacta.
const DEFAULT_LAT = 10.46538
const DEFAULT_LON = -73.2531

export default function WeatherWidget() {
  const [weather, setWeather] = useState<any>(null)

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Usamos Open-Meteo (Gratis y sin API Key)
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${DEFAULT_LAT}&longitude=${DEFAULT_LON}&current=temperature_2m,weather_code&timezone=auto`
        )
        const data = await res.json()
        setWeather(data.current)
      } catch (e) {
        console.error("Error clima", e)
      }
    }

    fetchWeather()
    // Actualizar cada 30 minutos
    const interval = setInterval(fetchWeather, 1000 * 60 * 30)
    return () => clearInterval(interval)
  }, [])

  if (!weather) return null

  // Mapear códigos WMO a Iconos
  const getIcon = (code: number) => {
    if (code <= 1) return <Sun className="h-8 w-8 text-yellow-400 animate-spin-slow" />
    if (code <= 48) return <Cloud className="h-8 w-8 text-slate-300" />
    if (code <= 67) return <CloudRain className="h-8 w-8 text-blue-400" />
    if (code <= 82) return <CloudRain className="h-8 w-8 text-blue-500" />
    if (code <= 99) return <CloudLightning className="h-8 w-8 text-purple-400" />
    return <Snowflake className="h-8 w-8 text-white" />
  }

  return (
    <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-5 py-3 rounded-full border border-slate-700 shadow-xl animate-in fade-in slide-in-from-top-4 duration-1000 delay-500">
      {getIcon(weather.weather_code)}
      <div className="flex flex-col leading-none">
        <span className="text-2xl font-bold text-white flex items-start">
            {Math.round(weather.temperature_2m)}°
        </span>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            Clima Actual
        </span>
      </div>
    </div>
  )
}