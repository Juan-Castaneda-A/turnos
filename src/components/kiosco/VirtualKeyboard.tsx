'use client'

import { Delete, CornerDownLeft, Space } from 'lucide-react'

interface VirtualKeyboardProps {
  mode: 'numeric' | 'qwerty'
  onKeyPress: (key: string) => void
  onDelete: () => void
  onEnter?: () => void
}

export default function VirtualKeyboard({ mode, onKeyPress, onDelete, onEnter }: VirtualKeyboardProps) {
  
  const handleClick = (key: string) => {
    // Pequeña vibración al tocar (Haptic Feedback) si el dispositivo lo soporta
    if (navigator.vibrate) navigator.vibrate(30)
    onKeyPress(key)
  }

  if (mode === 'numeric') {
    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
    return (
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto mt-6">
        {numbers.map((num) => (
          <button
            key={num}
            onClick={() => handleClick(num)}
            className="h-20 text-3xl font-bold bg-slate-700 text-white rounded-xl shadow-lg hover:bg-slate-600 active:scale-95 transition-all"
          >
            {num}
          </button>
        ))}
        <button onClick={onDelete} className="h-20 flex items-center justify-center bg-red-600/80 text-white rounded-xl shadow-lg hover:bg-red-600 active:scale-95 transition-all">
          <Delete size={32} />
        </button>
        <button onClick={() => handleClick('0')} className="h-20 text-3xl font-bold bg-slate-700 text-white rounded-xl shadow-lg hover:bg-slate-600 active:scale-95 transition-all">
          0
        </button>
        {onEnter && (
          <button onClick={onEnter} className="h-20 flex items-center justify-center bg-brand-600 text-white rounded-xl shadow-lg hover:bg-blue-500 active:scale-95 transition-all">
            <CornerDownLeft size={32} />
          </button>
        )}
      </div>
    )
  }

  // Modo QWERTY simplificado
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ]

  return (
    <div className="flex flex-col gap-2 w-full max-w-3xl mx-auto mt-4">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1.5">
          {row.map((char) => (
            <button
              key={char}
              onClick={() => handleClick(char)}
              className="flex-1 h-14 min-w-[30px] font-bold text-lg bg-slate-700 text-white rounded-lg shadow hover:bg-slate-600 active:scale-95 transition-all"
            >
              {char}
            </button>
          ))}
        </div>
      ))}
      <div className="flex justify-center gap-2 mt-2">
         <button onClick={onDelete} className="flex-[1.5] h-14 bg-red-600/80 text-white rounded-lg font-bold flex items-center justify-center active:scale-95">
            <Delete />
         </button>
         <button onClick={() => handleClick(' ')} className="flex-[4] h-14 bg-slate-600 text-white rounded-lg flex items-center justify-center active:scale-95">
            <Space /> ESPACIO
         </button>
         <button onClick={onEnter} className="flex-[2] h-14 bg-brand-600 text-white rounded-lg font-bold active:scale-95">
            LISTO
         </button>
      </div>
    </div>
  )
}