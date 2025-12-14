'use client'

import { useState, useEffect, useCallback, useRef } from 'react' // <--- Agregar useRef
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { getReportDataAction } from '@/actions/admin-reports'
import { timeToMinutes, formatDuration, generateInsights } from '@/lib/report-utils'
import { Loader2, TrendingUp, Users, Clock, AlertCircle, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { getDateRange } from '@/lib/date-utils'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas' // <--- Importante
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function ReportsView() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  
  // Referencia para capturar el gráfico
  const chartRef = useRef<HTMLDivElement>(null) // <--- NUEVO

  // Filtros
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [groupBy, setGroupBy] = useState('funcionario')

  const fetchData = useCallback(async () => {
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
  }, [startDate, endDate, groupBy])

  useEffect(() => {
    fetchData()
  }, [fetchData]) 

  const applyFilter = (range: 'today' | 'week' | 'month' | 'all') => {
    const { start, end } = getDateRange(range)
    setStartDate(start)
    setEndDate(end)
  }

  // --- EXPORTAR EXCEL (Igual que antes) ---
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data.map(row => ({
      Grupo: row.group_name,
      Turnos: row.turnos_atendidos,
      'Espera Promedio': formatDuration(row.tiempo_espera_promedio),
      'Atención Promedio': formatDuration(row.tiempo_atencion_promedio)
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Reporte")
    XLSX.writeFile(wb, `Reporte_${groupBy}_${startDate}.xlsx`)
  }

  // --- EXPORTAR PDF MEJORADO ---
  const exportPDF = async () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 20 // Posición vertical cursor

    // 1. TÍTULO
    doc.setFontSize(18)
    doc.text(`Reporte de Gestión - Notaría 3ra`, 14, yPos)
    yPos += 10
    doc.setFontSize(12)
    doc.text(`Período: ${startDate} al ${endDate} | Agrupado por: ${groupBy.toUpperCase()}`, 14, yPos)
    yPos += 15

    // 2. INSIGHTS (ANÁLISIS DE TEXTO)
    const currentInsights = generateInsights(data)
    doc.setFontSize(14)
    doc.setTextColor(40, 40, 40)
    doc.text("Análisis Automático (IA):", 14, yPos)
    yPos += 8
    
    doc.setFontSize(10)
    doc.setTextColor(80, 80, 80)
    currentInsights.forEach(insight => {
        // Dividir texto largo para que no se salga de la hoja
        const splitText = doc.splitTextToSize(`• ${insight}`, pageWidth - 28)
        doc.text(splitText, 14, yPos)
        yPos += (splitText.length * 5) + 2
    })
    yPos += 10

    // 3. GRÁFICO (CAPTURA DE PANTALLA)
    if (chartRef.current) {
        try {
            toast.info("Generando gráfico para PDF...")
            // Tomamos la foto del div del gráfico
            const canvas = await html2canvas(chartRef.current, { scale: 2 }) // Escala 2 para mejor calidad
            const imgData = canvas.toDataURL('image/png')
            
            // Calculamos dimensiones para ajustar al PDF (A4)
            const imgProps = doc.getImageProperties(imgData)
            const pdfWidth = pageWidth - 28
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
            
            // Si el gráfico no cabe en la página actual, nueva página
            if (yPos + pdfHeight > 280) {
                doc.addPage()
                yPos = 20
            }

            doc.addImage(imgData, 'PNG', 14, yPos, pdfWidth, pdfHeight)
            yPos += pdfHeight + 10
        } catch (e) {
            console.error("Error al capturar gráfico", e)
            toast.error("No se pudo incluir el gráfico en el PDF")
        }
    }

    // 4. TABLA DE DATOS
    const tableData = data.map(row => [
      row.group_name,
      row.turnos_atendidos,
      formatDuration(row.tiempo_espera_promedio),
      formatDuration(row.tiempo_atencion_promedio)
    ])

    autoTable(doc, {
      head: [['Nombre', 'Turnos', 'Espera Prom.', 'Atención Prom.']],
      body: tableData,
      startY: yPos,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] } // Azul bonito
    })

    doc.save(`Reporte_Completo_${groupBy}.pdf`)
    toast.success("PDF Generado exitosamente")
  }

  // --- CÁLCULOS (Igual que antes) ---
  const totalTurnos = data.reduce((acc, curr) => acc + curr.turnos_atendidos, 0)
  
  let totalWaitMin = 0
  let totalAttMin = 0
  data.forEach(d => {
    totalWaitMin += timeToMinutes(d.tiempo_espera_promedio) * d.turnos_atendidos
    totalAttMin += timeToMinutes(d.tiempo_atencion_promedio) * d.turnos_atendidos
  })
  
  const avgWait = totalTurnos > 0 ? (totalWaitMin / totalTurnos).toFixed(1) + 'm' : '0m'
  const avgAtt = totalTurnos > 0 ? (totalAttMin / totalTurnos).toFixed(1) + 'm' : '0m'

  const insights = generateInsights(data)

  const chartData = data.map(item => ({
    name: item.group_name,
    turnos: item.turnos_atendidos,
    espera: timeToMinutes(item.tiempo_espera_promedio),
    atencion: timeToMinutes(item.tiempo_atencion_promedio)
  }))

  return (
    <div className="space-y-6">
      
      {/* 1. KPIS SUPERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Total Turnos" value={totalTurnos} icon={<Users className="text-blue-400" />} color="bg-blue-500/10" />
        <KPICard title="Espera Promedio" value={avgWait} icon={<Clock className="text-yellow-400" />} color="bg-yellow-500/10" />
        <KPICard title="Atención Promedio" value={avgAtt} icon={<TrendingUp className="text-green-400" />} color="bg-green-500/10" />
      </div>

      {/* 2. FILTROS Y CONTROLES */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6 space-y-4">
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['today', 'week', 'month', 'all'].map((f) => (
               <Button 
                 key={f} 
                 variant="outline" 
                 size="sm" 
                 onClick={() => applyFilter(f as any)}
                 className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 capitalize"
               >
                 {f === 'today' ? 'Hoy' : f === 'week' ? 'Esta Semana' : f === 'month' ? 'Este Mes' : 'Histórico'}
               </Button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="w-full md:w-[160px]">
                <label className="text-xs text-slate-400 mb-1 block">Desde</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div className="w-full md:w-[160px]">
                <label className="text-xs text-slate-400 mb-1 block">Hasta</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div className="w-full md:w-[180px]">
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
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-500 text-white gap-2">
                  <FileDown size={18} /> Exportar Reporte
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700 text-white">
                <DropdownMenuItem onClick={exportExcel} className="cursor-pointer hover:bg-slate-700">Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF} className="cursor-pointer hover:bg-slate-700">PDF Completo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 3. GRÁFICO CON REFERENCIA PARA FOTO */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Rendimiento Visual</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Agregamos el ref aquí para que html2canvas sepa qué fotografiar */}
            <div ref={chartRef} className="h-[350px] w-full bg-slate-900 p-2 rounded-lg"> 
              {loading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorTurnos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="turnos" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTurnos)" />
                    <Area type="monotone" dataKey="espera" name="Espera (min)" stroke="#eab308" fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 4. INSIGHTS */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="text-green-400 h-5 w-5"/> Insights IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {insights.map((insight, i) => (
                <li key={i} className="text-sm text-slate-300 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 animate-in fade-in slide-in-from-right-2">
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
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{row.group_name}</td>
                    <td className="px-6 py-4 text-center">{row.turnos_atendidos}</td>
                    <td className="px-6 py-4 text-center">{formatDuration(row.tiempo_espera_promedio)}</td>
                    <td className="px-6 py-4 text-center">{formatDuration(row.tiempo_atencion_promedio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KPICard({ title, value, icon, color }: any) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`p-3 rounded-full ${color}`}>{icon}</div>
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}