// src/app/admin/layout.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/admin/LogoutButton'
import ChatWidget from '@/components/chat/ChatWidget'
import BrandingLogo from '@/components/ui/branding-logo'
import Link from 'next/link'
import {
    LayoutDashboard, Users, MonitorSmartphone,
    BarChart3, Settings, LogOut, Briefcase, GitMerge,
    MessageSquareText, History, UserCircle, ListOrdered,
    Megaphone
} from 'lucide-react'
import { logoutAction } from '@/actions/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // 1. Protección de Ruta (Solo Admins)
    const cookieStore = await cookies()
    const session = cookieStore.get('turnos_session')

    if (!session) redirect('/login')

    const user = JSON.parse(session.value)
    if (user.rol !== 'administrador') redirect('/funcionario/panel')

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex">
            {/* SIDEBAR FIJO */}
            <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col fixed h-full backdrop-blur-xl">
                <div className="p-6 border-b border-slate-800 flex justify-center">
                    {/* Reemplazamos el título de texto por el Logo */}
                    <BrandingLogo className="h-12 w-auto" />
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <AdminLink href="/admin/dashboard" icon={<LayoutDashboard size={18} />}>Dashboard</AdminLink>
                    <AdminLink href="/admin/usuarios" icon={<Users size={18} />}>Usuarios</AdminLink>
                    <AdminLink href="/admin/modulos" icon={<MonitorSmartphone size={18} />}>Módulos</AdminLink>
                    <AdminLink href="/admin/servicios" icon={<Briefcase size={18} />}>Servicios</AdminLink>
                    <AdminLink href="/admin/prioridades" icon={<ListOrdered size={18} />}>Prioridades</AdminLink>
                    <AdminLink href="/admin/asignaciones" icon={<GitMerge size={18} />}>Asignaciones</AdminLink>
                    <AdminLink href="/admin/reportes" icon={<BarChart3 size={18} />}>Reportes</AdminLink>
                    <AdminLink href="/admin/mensajes" icon={<MessageSquareText size={18} />}>Mensajes TV</AdminLink>
                    <AdminLink href="/admin/historial" icon={<History size={18} />}>Historial</AdminLink>
                    <AdminLink href="/admin/clientes" icon={<UserCircle size={18} />}>Clientes</AdminLink>
                    <AdminLink href="/admin/apariencia" icon={<MonitorSmartphone size={18} />}>Apariencia</AdminLink>
                    <AdminLink href="/admin/marketing" icon={<Megaphone size={18}/>}>Marketing TV</AdminLink>
                    <div className="pt-4 mt-4 border-t border-slate-800">
                        <AdminLink href="/admin/configuracion" icon={<Settings size={18} />}>Configuración</AdminLink>
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <LogoutButton />
                </div>
            </aside>

            {/* CONTENIDO DINÁMICO */}
            <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen bg-slate-950">
                {children}
            </main>
            <ChatWidget userId={user.id} userName={user.nombre} />
        </div>
    )
}

// Componente pequeño para los links (para no repetir clases)
function AdminLink({ href, icon, children }: { href: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
            {icon}
            {children}
        </Link>
    )
}