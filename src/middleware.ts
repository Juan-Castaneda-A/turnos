import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('turnos_session')
  const path = request.nextUrl.pathname

  // 1. Si intenta entrar a rutas protegidas sin sesión
  if (!session && (path.startsWith('/admin') || path.startsWith('/funcionario'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Si ya tiene sesión e intenta entrar al login
  if (session && path === '/login') {
    const user = JSON.parse(session.value)
    if (user.rol === 'administrador') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    } else {
      return NextResponse.redirect(new URL('/funcionario/panel', request.url))
    }
  }

  // 3. Protección de Roles (Funcionario no puede entrar a Admin)
  if (session && path.startsWith('/admin')) {
    const user = JSON.parse(session.value)
    if (user.rol !== 'administrador') {
      // Si es funcionario y quiere entrar a admin, lo mandamos a su panel
      return NextResponse.redirect(new URL('/funcionario/panel', request.url))
    }
  }

  // 4. Protección de Roles (Admin no debería necesitar entrar al panel de funcionario, opcional)
  // (A veces el admin sí quiere ver el panel, así que podemos dejarlo pasar o bloquearlo, tú decides)

  return NextResponse.next()
}

// Configuración: A qué rutas afecta este middleware
export const config = {
  matcher: [
    '/admin/:path*',
    '/funcionario/:path*',
    '/login'
  ]
}