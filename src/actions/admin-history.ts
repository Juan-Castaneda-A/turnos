'use server'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Tipos para los filtros
type HistoryFilters = {
  startDate?: string
  endDate?: string
  serviceId?: string
  page?: number
  pageSize?: number
}

export async function getTurnHistoryAction({ 
  startDate, 
  endDate, 
  serviceId, 
  page = 1, 
  pageSize = 20 
}: HistoryFilters) {
  try {
    let query = supabase
      .from('turnos')
      .select(`
        *,
        servicios(nombre_servicio),
        modulos(nombre_modulo),
        logs_turnos(accion, hora_accion)
      `, { count: 'exact' })
      .order('hora_solicitud', { ascending: false })

    // Aplicar Filtros
    if (startDate) query = query.gte('hora_solicitud', `${startDate}T00:00:00`)
    if (endDate) query = query.lte('hora_solicitud', `${endDate}T23:59:59`)
    if (serviceId && serviceId !== 'all') query = query.eq('id_servicio', serviceId)

    // Aplicar Paginación
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    return { 
      success: true, 
      data: data || [], 
      total: count || 0,
      page,
      pageSize
    }
  } catch (e: any) {
    console.error("Error fetching history:", e)
    return { success: false, message: e.message, data: [], total: 0 }
  }
}