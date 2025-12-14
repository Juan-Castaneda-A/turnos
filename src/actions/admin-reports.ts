'use server'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getReportDataAction(formData: FormData) {
  const start = formData.get('start') as string
  const end = formData.get('end') as string
  const groupBy = formData.get('groupBy') as string

  try {
    // Llamada al RPC existente en tu DB
    const { data, error } = await supabase.rpc('get_report_data', {
      start_date: start,
      end_date: end,
      group_by_param: groupBy // 'funcionario', 'servicio', 'modulo'
    })

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (e: any) {
    console.error("Error fetching reports:", e)
    return { success: false, message: e.message, data: [] }
  }
}