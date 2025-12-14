'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Rellamar: Actualiza la hora para que vuelva a sonar
export async function recallTurnAction(turnId: number) {
  try {
    const { error } = await supabase
      .from('turnos')
      .update({ hora_llamado: new Date().toISOString() })
      .eq('id_turno', turnId)

    if (error) throw error
    
    // Enviamos evento broadcast manual para forzar sonido en TV
    // (Opcional, si el trigger de la DB ya lo hace)
    
    return { success: true }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

// Transferir: Mueve el turno a otro módulo
export async function transferTurnAction(turnId: number, targetModuleId: number) {
  try {
    const { error } = await supabase
      .from('turnos')
      .update({
        estado: 'en espera', // Vuelve a la cola
        id_modulo_atencion: null, // Ya no lo atiendo yo
        id_modulo_reasignado: targetModuleId, // Se va al otro módulo
        hora_llamado: null,
        hora_finalizacion: null
      })
      .eq('id_turno', turnId)

    if (error) throw error
    revalidatePath('/funcionario/panel')
    return { success: true, message: 'Turno transferido exitosamente' }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}