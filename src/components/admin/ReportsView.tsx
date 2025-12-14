'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { getReportDataAction } from '@/actions/admin-reports'
import { timeToMinutes, formatDuration, generateInsights } from '@/lib/report-utils'
import { Loader2, TrendingUp, Users, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function ReportsView() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  
  // Estados de filtros (Valores por defecto: Hoy)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [groupBy, setGroupBy] = useState('funcionario')

  const fetchData = async () => {
    setLoading(true)
    const formData = new FormData()
    formData.append('start', startDate)
    formData.append('end', endDate)
    formData.append('groupBy', groupBy)

    const res = await getReportDataAction(formData)
    setLoading(false)

    if (res.success) {
      setData(res.data)
    } else {
      toast.error(res.message)
    }
  }

  // Cargar al inicio y cuando cambien filtros
  useEffect(() => {
    fetchData()
  }, []) // Carga inicial

  // Calcular KPIs Totales
  const totalTurnos = data.reduce((acc, curr) => acc + curr.turnos_atendidos, 0)
  const insights = generateInsights(data)

  // Datos formateados para el gráfico
  const chartData = data.map(item => ({
    name: item.group_name,
    turnos: item.turnos_atendidos,
    espera: timeToMinutes(item.tiempo_espera_promedio),
    atencion: timeToMinutes(item.tiempo_atencion_promedio)
  }))

  return (
    <div className="space-y-6">
      
      {/* 1. BARRA DE FILTROS */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-auto">
              <label className="text-xs text-slate-400 mb-1 block">Fecha Inicio</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="w-full md:w-auto">
              <label className="text-xs text-slate-400 mb-1 block">Fecha Fin</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="w-full md:w-[200px]">
              <label className="text-xs text-slate-400 mb-1 block">Agrupar Por</label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="funcionario">Funcionario</SelectItem>
                  <SelectItem value="servicio">Servicio</SelectItem>
                  <SelectItem value="modulo">Módulo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchData} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white w-full md:w-auto">
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Generar Reporte
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. KPIs RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-500/10 text-blue-400"><Users /></div>
            <div>
              <p className="text-sm text-slate-400">Total Turnos</p>
              <p className="text-2xl font-bold text-white">{totalTurnos}</p>
            </div>
          </CardContent>
        </Card>
        {/* Aquí podrías agregar más KPIs calculados */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 3. GRÁFICO (RECHARTS) */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Rendimiento por {groupBy}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                    cursor={{fill: '#334155', opacity: 0.2}}
                  />
                  <Legend />
                  <Bar dataKey="turnos" name="Turnos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="espera" name="Espera (min)" fill="#eab308" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 4. INSIGHTS AUTOMÁTICOS */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="text-green-400 h-5 w-5"/> Análisis IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {insights.map((insight, i) => (
                <li key={i} className="text-sm text-slate-300 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 5. TABLA DE DATOS */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Datos Detallados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                <tr>
                  <th className="px-6 py-3">{groupBy.toUpperCase()}</th>
                  <th className="px-6 py-3 text-center">Turnos</th>
                  <th className="px-6 py-3 text-center">T. Espera Prom.</th>
                  <th className="px-6 py-3 text-center">T. Atención Prom.</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-medium text-white">{row.group_name}</td>
                    <td className="px-6 py-4 text-center">{row.turnos_atendidos}</td>
                    <td className="px-6 py-4 text-center">{formatDuration(row.tiempo_espera_promedio)}</td>
                    <td className="px-6 py-4 text-center">{formatDuration(row.tiempo_atencion_promedio)}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No hay datos para el rango seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}