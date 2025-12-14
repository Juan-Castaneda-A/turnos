'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function updateModuleServicePriorityAction(
  id_modulo: number, 
  id_servicio: number, 
  newPriority: number
) {
  try {
    const { error } = await supabase
      .from('modulos_servicios')
      .update({ prioridad: newPriority })
      .match({ id_modulo, id_servicio })

    if (error) throw error
    
    revalidatePath('/admin/prioridades')
    return { success: true }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}