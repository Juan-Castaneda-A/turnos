'use server'

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function createUserAction(formData: FormData) {
  const nombre = formData.get('nombre') as string
  const usuario = formData.get('usuario') as string
  const password = formData.get('password') as string
  const rol = formData.get('rol') as string
  const modulo = formData.get('modulo') ? parseInt(formData.get('modulo') as string) : null

  if (!nombre || !usuario || !password) return { success: false, message: 'Faltan datos' }

  try {
    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    const { error } = await supabase.from('usuarios').insert({
      nombre_completo: nombre,
      nombre_usuario: usuario,
      contrasena: hashedPassword,
      rol: rol,
      id_modulo_asignado: modulo
    })

    if (error) throw error

    // ¡TRUCO DE NEXT.JS! Esto actualiza la tabla automáticamente sin recargar la página
    revalidatePath('/admin/usuarios') 
    return { success: true, message: 'Usuario creado' }

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