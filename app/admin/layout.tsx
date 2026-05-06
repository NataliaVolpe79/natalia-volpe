'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Calendar, Users, CreditCard,
  Settings, Bell, LogOut, Menu, X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/admin', label: 'Inicio', Icon: LayoutDashboard },
  { href: '/admin/turnos', label: 'Turnos', Icon: Calendar },
  { href: '/admin/pacientes', label: 'Pacientes', Icon: Users },
  { href: '/admin/pagos', label: 'Pagos', Icon: CreditCard },
  { href: '/admin/recordatorios', label: 'Recordatorios', Icon: Bell },
  { href: '/admin/configuracion', label: 'Config', Icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && pathname !== '/admin/login') {
        router.push('/admin/login')
      }
      setChecking(false)
    })
  }, [pathname, router])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (pathname === '/admin/login') return <>{children}</>
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">N</span>
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">Panel Admin</span>
          </div>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-base font-semibold transition-colors',
                  pathname === href
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100',
                ].join(' ')}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={logout}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 font-semibold transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Salir
            </button>
            <button
              onClick={() => setMenuOpen(m => !m)}
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white border-b border-gray-200 shadow-lg z-20"
        >
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {navItems.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={[
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-semibold transition-colors',
                  pathname === href
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100',
                ].join(' ')}
              >
                <Icon className="w-6 h-6" />
                {label}
              </Link>
            ))}
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-6 h-6" />
              Cerrar sesión
            </button>
          </nav>
        </motion.div>
      )}

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-bottom">
        <div className="grid grid-cols-6">
          {navItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={[
                'flex flex-col items-center py-3 gap-0.5 transition-colors',
                pathname === href ? 'text-blue-600' : 'text-gray-500',
              ].join(' ')}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  )
}
