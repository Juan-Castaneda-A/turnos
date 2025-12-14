import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4 text-center">
      <div className="bg-slate-900 p-6 rounded-full mb-6 border border-slate-800 shadow-2xl shadow-blue-900/20">
        <FileQuestion className="h-16 w-16 text-blue-500" />
      </div>
      <h1 className="text-4xl font-bold mb-2">404 - Ruta no encontrada</h1>
      <p className="text-slate-400 mb-8 max-w-md">
        Parece que te has perdido en el sistema. Esta página no existe o no tienes acceso.
      </p>
      
      <div className="flex gap-4">
        <Link 
          href="/solicitar-turno" 
          className="px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors border border-slate-700"
        >
          Ir al Kiosco
        </Link>
        <Link 
          href="/login" 
          className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          Iniciar Sesión
        </Link>
      </div>
    </div>
  )
}