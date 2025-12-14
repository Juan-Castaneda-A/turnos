// src/actions/auth.ts
'use server'

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  console.log(`🔍 Intentando login para: ${username}`) // LOG 1

  if (!username || !password) {
    return { success: false, message: 'Faltan datos' }
  }

  try {
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('nombre_usuario', username)
      .single()

    if (error || !user) {
      console.log("❌ Usuario no encontrado en DB") // LOG 2
      return { success: false, message: 'Usuario no encontrado' }
    }

    console.log("✅ Usuario encontrado. Verificando contraseña...") // LOG 3
    
    // --- LÓGICA HÍBRIDA DE VERIFICACIÓN ---
    let isValid = false

    // 1. Intento: Texto Plano (Compara tal cual)
    if (user.contrasena === password) {
        console.log("⚠️ ÉXITO: La contraseña estaba en texto plano.")
        isValid = true
    } 
    // 2. Intento: Bcrypt (Node.js estándar)
    else if (await bcrypt.compare(password, user.contrasena)) {
        console.log("🔒 ÉXITO: La contraseña es un hash Bcrypt válido.")
        isValid = true
    }
    // 3. Diagnóstico de Python (Werkzeug)
    else if (user.contrasena.startsWith('scrypt:') || user.contrasena.startsWith('pbkdf2:')) {
        console.log("🐍 ERROR: La contraseña es un hash de Python (Werkzeug). Bcrypt no puede leerla.")
        console.log("👉 SOLUCIÓN: Ve a Supabase y cambia la contraseña de este usuario manualmente.")
    } else {
        console.log("❌ Fallo: La contraseña no coincide ni en texto plano ni en Bcrypt.")
    }

    if (!isValid) {
      return { success: false, message: 'Contraseña incorrecta (o formato incompatible)' }
    }

    // --- LOGIN EXITOSO ---
    const sessionData = JSON.stringify({
      id: user.id_usuario,
      nombre: user.nombre_completo,
      rol: user.rol,
      modulo: user.id_modulo_asignado
    })

    const cookieStore = await cookies()
    cookieStore.set('turnos_session', sessionData, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8 
    })

    return { success: true, user }

  } catch (error) {
    console.error("🔥 Error crítico:", error)
    return { success: false, message: 'Error del servidor' }
  }
}

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('turnos_session')
  return { success: true }
}