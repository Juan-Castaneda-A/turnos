import { redirect } from 'next/navigation'

export default function Home() {
  // Redirigir automáticamente al Kiosco
  redirect('/solicitar-turno')
}