'use client'

import { useEffect, useState, useCallback } from 'react'

export const useTTS = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [spanishVoice, setSpanishVoice] = useState<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices()
      setVoices(available)
      
      // Buscar la mejor voz en español
      // Prioridad: Google Español, Microsoft Sabina/Mexico, o cualquiera que empiece por 'es'
      const bestVoice = available.find(v => 
        (v.lang.includes('es') && (v.name.includes('Google') || v.name.includes('Mexico') || v.name.includes('Colombia'))) 
        || v.lang.startsWith('es')
      )
      
      setSpanishVoice(bestVoice || null)
    }

    loadVoices()
    
    // Chrome carga las voces de forma asíncrona
    window.speechSynthesis.onvoiceschanged = loadVoices
  }, [])

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return

    // Cancelar cualquier audio anterior para que no se acumulen
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    
    if (spanishVoice) {
      utterance.voice = spanishVoice
    }
    
    utterance.lang = 'es-CO' // Forzar español Colombia/Latino
    utterance.rate = 0.9     // Un poco más lento para claridad
    utterance.pitch = 1      // Tono normal
    utterance.volume = 1

    window.speechSynthesis.speak(utterance)
  }, [spanishVoice])

  return { speak }
}