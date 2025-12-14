'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function createModuleAction(formData: FormData) {
  const nombre = formData.get('nombre') as string
  const descripcion = formData.get('descripcion') as string
  const estado = formData.get('estado') === 'on' ? 'activo' : 'inactivo'

  if (!nombre) return { success: false, message: 'El nombre es obligatorio' }

  try {
    const { error } = await supabase.from('modulos').insert({
      nombre_modulo: nombre,
      descripcion: descripcion,
      estado: estado
    })

    if (error) throw error
    revalidatePath('/admin/modulos')
    return { success: true, message: 'Módulo creado' }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

export async function toggleModuleStatusAction(id: number, nuevoEstado: boolean) {
  try {
    const estadoStr = nuevoEstado ? 'activo' : 'inactivo'
    const { error } = await supabase
      .from('modulos')
      .update({ estado: estadoStr })
      .eq('id_modulo', id)

    if (error) throw error
    revalidatePath('/admin/modulos')
    return { success: true, message: `Módulo ${estadoStr}` }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

export async function deleteModuleAction(id: number) {
  try {
    const { error } = await supabase.from('modulos').delete().eq('id_modulo', id)
    if (error) throw error
    
    revalidatePath('/admin/modulos')
    return { success: true, message: 'Módulo eliminado' }
  } catch (e: any) {
    // Es probable que falle si tiene turnos o usuarios asignados (Foreing Key constraint)
    return { success: false, message: 'No se puede eliminar: Probablemente tiene usuarios o turnos asociados.' }
  }
}