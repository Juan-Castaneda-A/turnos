'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function createOrUpdateMessageAction(formData: FormData) {
  const id = formData.get('id') as string
  const texto = formData.get('texto') as string
  // Si es nuevo, por defecto activo. Si es edit, respetamos lo que diga el form (o la tabla lo maneja)
  const isActive = formData.get('activo') === 'on'

  if (!texto) return { success: false, message: 'El texto es obligatorio' }

  try {
    const data = { texto_mensaje: texto, is_active: isActive }

    if (id) {
      // Al editar el texto, no cambiamos el estado "is_active" aquí obligatoriamente, 
      // a menos que quieras poner el switch en el formulario también.
      // Por simplicidad, actualizamos solo el texto si el switch está en la tabla.
      await supabase.from('mensajes_visualizador').update({ texto_mensaje: texto }).eq('id', id)
    } else {
      await supabase.from('mensajes_visualizador').insert(data)
    }

    revalidatePath('/admin/mensajes')
    return { success: true, message: id ? 'Mensaje actualizado' : 'Mensaje creado' }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

export async function toggleMessageStatusAction(id: number, nuevoEstado: boolean) {
  try {
    const { error } = await supabase
      .from('mensajes_visualizador')
      .update({ is_active: nuevoEstado })
      .eq('id', id)

    if (error) throw error
    revalidatePath('/admin/mensajes')
    return { success: true, message: 'Estado actualizado' }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

export async function deleteMessageAction(id: number) {
  try {
    const { error } = await supabase.from('mensajes_visualizador').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/admin/mensajes')
    return { success: true, message: 'Mensaje eliminado' }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}