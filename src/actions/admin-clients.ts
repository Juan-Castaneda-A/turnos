'use server'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getClientsAction(search: string = '', page: number = 1) {
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  try {
    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('creado_en', { ascending: false }) // Más recientes primero

    if (search) {
      // Búsqueda inteligente: busca en nombre O en cédula
      query = query.or(`nombre_completo.ilike.%${search}%,numero_identificacion.ilike.%${search}%`)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) throw error

    return { 
      success: true, 
      data: data || [], 
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  } catch (e: any) {
    console.error(e)
    return { success: false, message: e.message, data: [], total: 0 }
  }
}