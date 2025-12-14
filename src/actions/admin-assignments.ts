'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function toggleAssignmentAction(moduleId: number, serviceId: number, shouldAssign: boolean) {
  try {
    if (shouldAssign) {
      // CREAR LA RELACIÓN
      // Usamos upsert o insert con ignore para evitar duplicados por si acaso
      const { error } = await supabase
        .from('modulos_servicios')
        .insert({ id_modulo: moduleId, id_servicio: serviceId })
        .select() // Importante para verificar
      
      if (error) throw error
      
    } else {
      // BORRAR LA RELACIÓN
      const { error } = await supabase
        .from('modulos_servicios')
        .delete()
        .match({ id_modulo: moduleId, id_servicio: serviceId })

      if (error) throw error
    }

    revalidatePath('/admin/asignaciones')
    return { success: true }

  } catch (e: any) {
    console.error("Error en toggleAssignment:", e)
    return { success: false, message: e.message }
  }
}