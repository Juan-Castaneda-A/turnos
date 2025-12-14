'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function resetDailyTurnsAction() {
  try {
    // Borramos TODOS los turnos.
    // NOTA: Como tu lógica de "Crear Turno" (RPC) busca el último número del día,
    // al borrar todo, el contador se reiniciará automáticamente a 1.
    const { error } = await supabase
      .from('turnos')
      .delete()
      .neq('id_turno', -1) // Un truco seguro para decir "borra todo donde el ID no sea -1" (o sea, todos)

    if (error) throw error

    // También limpiamos los logs si quieres empezar 100% fresco (opcional)
    // await supabase.from('logs_turnos').delete().neq('id_log', -1)

    // Revalidamos todas las rutas importantes
    revalidatePath('/admin')
    revalidatePath('/visualizador')
    revalidatePath('/funcionario/panel')
    revalidatePath('/kiosco')

    return { success: true, message: 'Sistema reseteado: Los turnos inician desde 001.' }

  } catch (e: any) {
    console.error(e)
    return { success: false, message: 'Error al resetear: ' + e.message }
  }
}