'use server'

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function createOrUpdateUserAction(formData: FormData) {
  const id = formData.get('id') as string // <--- Capturamos el ID si existe
  const nombre = formData.get('nombre') as string
  const usuario = formData.get('usuario') as string
  const password = formData.get('password') as string
  const rol = formData.get('rol') as string
  const modulo = formData.get('modulo') ? parseInt(formData.get('modulo') as string) : null

  if (!nombre || !usuario) return { success: false, message: 'Faltan datos' }

  try {
    const userData: any = {
      nombre_completo: nombre,
      nombre_usuario: usuario,
      rol: rol,
      id_modulo_asignado: modulo
    }

    // Lógica de contraseña: Solo la hasheamos si el usuario escribió una nueva
    if (password) {
      userData.contrasena = await bcrypt.hash(password, 10)
    } else if (!id) {
      // Si es CREACIÓN (no hay ID) y no hay password, error
      return { success: false, message: 'La contraseña es obligatoria para nuevos usuarios' }
    }

    let error;

    if (id) {
      // --- ACTUALIZAR ---
      const res = await supabase.from('usuarios').update(userData).eq('id_usuario', id)
      error = res.error
    } else {
      // --- CREAR ---
      const res = await supabase.from('usuarios').insert(userData)
      error = res.error
    }

    if (error) throw error

    revalidatePath('/admin/usuarios')
    return { success: true, message: id ? 'Usuario actualizado' : 'Usuario creado' }

  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

export async function deleteUserAction(id: number) {
  try {
    const { error } = await supabase.from('usuarios').delete().eq('id_usuario', id)
    if (error) throw error
    
    revalidatePath('/admin/usuarios')
    return { success: true, message: 'Usuario eliminado' }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}