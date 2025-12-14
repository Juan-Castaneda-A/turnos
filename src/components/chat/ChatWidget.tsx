'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { MessageCircle, Send, X, Users } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet"
import { getMessagesAction, getMyRoomsAction, sendMessageAction } from '@/actions/chat'
import { toast } from 'sonner'

export default function ChatWidget({ userId, userName }: { userId: number, userName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [rooms, setRooms] = useState<any[]>([])
  const [currentRoom, setCurrentRoom] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Cargar Salas al abrir
  useEffect(() => {
    if (isOpen) {
      getMyRoomsAction(userId).then(res => {
        if (res.success) setRooms(res.rooms)
      })
    }
  }, [isOpen, userId])

  // 2. Cargar Mensajes al seleccionar sala
  useEffect(() => {
    if (!currentRoom) return

    // Carga inicial
    getMessagesAction(currentRoom.id).then(res => {
      if (res.success) setMessages(res.messages)
    })

    // Realtime: Escuchar mensajes NUEVOS en esta sala
    const channel = supabase.channel(`room_${currentRoom.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `room_id=eq.${currentRoom.id}`
      }, (payload) => {
        // Fetch para obtener el nombre del sender (o optimista)
        getMessagesAction(currentRoom.id).then(res => {
            if(res.success) setMessages(res.messages)
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentRoom, supabase])

  // Scroll al fondo al recibir mensaje
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentRoom) return

    const tempMsg = newMessage
    setNewMessage('') // Limpiar input rápido

    const res = await sendMessageAction(currentRoom.id, userId, tempMsg)
    if (!res.success) {
        toast.error("Error al enviar")
        setNewMessage(tempMsg) // Devolver texto si falla
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-500 shadow-2xl z-50 flex items-center justify-center animate-in zoom-in duration-300"
        >
          <MessageCircle className="h-7 w-7 text-white" />
          {/* Aquí podrías poner un badge rojo si hay mensajes sin leer */}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:w-[400px] p-0 bg-slate-950 border-l border-slate-800 text-white flex flex-col">
        
        {/* HEADER */}
        <SheetHeader className="p-4 border-b border-slate-800 bg-slate-900">
          <SheetTitle className="text-white flex items-center justify-between">
            {currentRoom ? (
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setCurrentRoom(null)} className="h-8 w-8 p-0 -ml-2 mr-2">
                        <span className="text-xl">←</span>
                    </Button>
                    <span className="truncate max-w-[200px]">{currentRoom.nombre}</span>
                </div>
            ) : (
                "Chats Internos"
            )}
          </SheetTitle>
        </SheetHeader>

        {/* CONTENIDO (LISTA O MENSAJES) */}
        <div className="flex-1 overflow-hidden flex flex-col">
            
            {/* VISTA A: LISTA DE SALAS */}
            {!currentRoom && (
                <ScrollArea className="flex-1 p-4">
                    {rooms.length === 0 ? (
                        <p className="text-center text-slate-500 mt-10">No tienes chats activos.</p>
                    ) : (
                        rooms.map(room => (
                            <div 
                                key={room.id}
                                onClick={() => setCurrentRoom(room)}
                                className="flex items-center gap-4 p-4 hover:bg-slate-900 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-800 mb-2"
                            >
                                <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center text-blue-400">
                                    <Users size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm text-slate-200">{room.nombre}</h4>
                                    <p className="text-xs text-slate-500">Toca para abrir</p>
                                </div>
                            </div>
                        ))
                    )}
                </ScrollArea>
            )}

            {/* VISTA B: CHAT ACTIVO */}
            {currentRoom && (
                <>
                    <ScrollArea className="flex-1 p-4 bg-slate-950">
                        <div className="space-y-4">
                            {messages.map((msg) => {
                                const isMe = msg.sender_id === userId
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                                            isMe 
                                                ? 'bg-blue-600 text-white rounded-br-none' 
                                                : 'bg-slate-800 text-slate-200 rounded-bl-none'
                                        }`}>
                                            {!isMe && <p className="text-[10px] text-slate-400 font-bold mb-1">{msg.sender?.nombre_completo}</p>}
                                            <p>{msg.content}</p>
                                            <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>
                                                {new Date(msg.sent_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>

                    {/* INPUT AREA */}
                    <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
                        <Input 
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            placeholder="Escribe un mensaje..." 
                            className="bg-slate-800 border-slate-700 text-white focus-visible:ring-blue-500"
                        />
                        <Button type="submit" size="icon" className="bg-blue-600 hover:bg-blue-500 text-white">
                            <Send size={18} />
                        </Button>
                    </form>
                </>
            )}
        </div>

      </SheetContent>
    </Sheet>
  )
}