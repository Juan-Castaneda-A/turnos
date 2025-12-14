'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function createServiceAction(formData: FormData) {
  const nombre = formData.get('nombre') as string
  const prefijo = formData.get('prefijo') as string

  if (!nombre || !prefijo) return { success: false, message: 'Faltan datos' }

  try {
    const { error } = await supabase.from('servicios').insert({
      nombre_servicio: nombre,
      prefijo_ticket: prefijo.toUpperCase() // Siempre mayúsculas (ej: A, B, RC)
    })

    if (error) throw error
    revalidatePath('/admin/servicios')
    return { success: true, message: 'Servicio creado exitosamente' }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

export async function deleteServiceAction(id: number) {
  try {
    const { error } = await supabase.from('servicios').delete().eq('id_servicio', id)
    if (error) throw error
    
    revalidatePath('/admin/servicios')
    return { success: true, message: 'Servicio eliminado' }
  } catch (e: any) {
    // Error común: El servicio ya tiene turnos creados
    return { success: false, message: 'No se puede eliminar: Probablemente tiene historial de turnos.' }
  }
}