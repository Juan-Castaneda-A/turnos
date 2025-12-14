'use server'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Obtener las salas donde está el usuario
export async function getMyRoomsAction(userId: number) {
  try {
    // Consulta con Joins para saber el nombre de la sala o del otro participante
    // Nota: Esto depende de tu estructura exacta. Asumiré una estructura estándar.
    
    // 1. Obtener IDs de salas donde soy participante
    const { data: participations, error } = await supabase
      .from('chat_participants')
      .select('room_id, chat_rooms(*)')
      .eq('user_id', userId)

    if (error) throw error

    // Formatear la respuesta
    const rooms = participations.map((p: any) => ({
      id: p.room_id,
      nombre: p.chat_rooms?.nombre || 'Chat Directo',
      tipo: p.chat_rooms?.tipo,
      last_message: '...' // Podríamos buscar el último mensaje aquí
    }))

    return { success: true, rooms }
  } catch (e: any) {
    return { success: false, message: e.message, rooms: [] }
  }
}

export async function sendMessageAction(roomId: number, userId: number, content: string) {
  if (!content.trim()) return { success: false }

  try {
    const { error } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: userId,
      content: content,
      // created_at se pone solo
    })

    if (error) throw error
    return { success: true }
  } catch (e: any) {
    console.error(e)
    return { success: false, message: e.message }
  }
}

export async function getMessagesAction(roomId: number) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, sender:sender_id(nombre_completo)') // Join con usuarios
      .eq('room_id', roomId)
      .order('sent_at', { ascending: true }) // Mensajes viejos arriba

    if (error) throw error
    return { success: true, messages: data }
  } catch (e: any) {
    return { success: false, message: e.message, messages: [] }
  }
}