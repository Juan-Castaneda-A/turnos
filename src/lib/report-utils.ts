// Convierte "00:12:30" a minutos (float) para el gráfico
export const timeToMinutes = (timeStr: string | null) => {
  if (!timeStr) return 0
  const [h, m, s] = timeStr.split(':').map(Number)
  return parseFloat((h * 60 + m + s / 60).toFixed(2))
}

// Convierte "00:12:30" a texto bonito "12m 30s"
export const formatDuration = (timeStr: string | null) => {
  if (!timeStr) return '0m'
  const [h, m, s] = timeStr.split(':').map(Number)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${Math.round(s)}s`
}

// Generador de Insights (Tu lógica portada a TS)
export const generateInsights = (data: any[]) => {
  if (!data || data.length === 0) return ["No hay datos suficientes para el análisis."]
  
  const insights: string[] = []
  
  // Ordenar por tiempo de espera (descendente)
  const sortedByWait = [...data].sort((a, b) => timeToMinutes(b.tiempo_espera_promedio) - timeToMinutes(a.tiempo_espera_promedio))
  
  // 1. Cuello de botella
  const slowest = sortedByWait[0]
  if (slowest && timeToMinutes(slowest.tiempo_espera_promedio) > 10) { // Umbral arbitrario de 10 min
    insights.push(`⚠️ Punto Crítico: "${slowest.group_name}" tiene el mayor tiempo de espera (${formatDuration(slowest.tiempo_espera_promedio)}).`)
  }

  // 2. El más eficiente
  const fastest = sortedByWait[sortedByWait.length - 1]
  if (fastest) {
    insights.push(`✅ Punto Fuerte: "${fastest.group_name}" tiene la atención más ágil (${formatDuration(fastest.tiempo_espera_promedio)} espera).`)
  }

  // 3. Volumen
  const sortedByVolume = [...data].sort((a, b) => b.turnos_atendidos - a.turnos_atendidos)
  const busiest = sortedByVolume[0]
  if (busiest) {
    insights.push(`📈 Alto Volumen: "${busiest.group_name}" procesó la mayor cantidad de turnos (${busiest.turnos_atendidos}).`)
  }

  return insights
}