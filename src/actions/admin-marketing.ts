'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function deleteAdAction(id: number, imageUrl: string) {
  try {
    // 1. Borrar de DB
    await supabase.from('anuncios_tv').delete().eq('id', id)
    
    // 2. Intentar borrar del Storage (Opcional, para limpiar)
    const fileName = imageUrl.split('/').pop()
    if (fileName) await supabase.storage.from('ads').remove([fileName])

    revalidatePath('/admin/marketing')
    return { success: true }
  } catch (e: any) { return { success: false, message: e.message } }
}

export async function toggleAdAction(id: number, status: boolean) {
    await supabase.from('anuncios_tv').update({ activo: status }).eq('id', id)
    revalidatePath('/admin/marketing')
    return { success: true }
}