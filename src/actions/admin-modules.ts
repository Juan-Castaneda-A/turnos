'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function createOrUpdateModuleAction(formData: FormData) {
  const id = formData.get('id') as string
  const nombre = formData.get('nombre') as string
  const descripcion = formData.get('descripcion') as string
  // Si estamos editando, el estado no se cambia aquí (se usa el Switch de la tabla), 
  // pero si es nuevo, por defecto activo.
  const estado = formData.get('estado') === 'on' ? 'activo' : 'inactivo'

  if (!nombre) return { success: false, message: 'Faltan datos' }

  try {
    const moduleData = { nombre_modulo: nombre, descripcion: descripcion }
    
    // Solo asignamos estado si es nuevo (para no sobreescribir el switch accidentalmente)
    if (!id) Object.assign(moduleData, { estado })

    if (id) {
      await supabase.from('modulos').update(moduleData).eq('id_modulo', id)
    } else {
      await supabase.from('modulos').insert(moduleData)
    }

    revalidatePath('/admin/modulos')
    return { success: true, message: id ? 'Módulo actualizado' : 'Módulo creado' }
  } catch (e: any) { return { success: false, message: e.message } }
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