'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Grid3X3,
  FolderKanban,
  LogOut,
  Menu,
  X,
  Bell
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin/tables', label: 'Quản lý bàn', icon: Grid3X3 },
  { href: '/admin/categories', label: 'Danh mục', icon: FolderKanban },
  { href: '/admin/products', label: 'Món ăn', icon: UtensilsCrossed },
  { href: '/admin/orders', label: 'Đơn hàng', icon: ClipboardList },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [newOrderCount, setNewOrderCount] = useState(0)

  useEffect(() => {
    const supabase = supabaseRef.current

    // Channel 1: Listen for new orders (postgres_changes)
    const ordersChannel = supabase
      .channel('admin-new-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as { customer_name?: string; table_id?: number }
          setNewOrderCount(prev => prev + 1)
          toast(`🔔 Đơn hàng mới${newOrder.customer_name ? ` từ ${newOrder.customer_name}` : ''}!`, {
            duration: 5000,
            style: {
              background: '#f97316',
              color: '#fff',
              fontWeight: 600,
            },
          })
          // Play notification sound
          try {
            const audio = new Audio('/notification.wav')
            audio.volume = 0.5
            audio.play().catch(() => {})
          } catch {}
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] orders channel:', status)
      })

    // Channel 2: Listen for staff call broadcast
    const staffChannel = supabase
      .channel('staff-call')
      .on(
        'broadcast',
        { event: 'call-staff' },
        (payload) => {
          const data = payload.payload as { tableName?: string; customerName?: string }
          toast(`🔔 ${data.tableName || 'Có bàn'} đang gọi nhân viên!${data.customerName ? ` (${data.customerName})` : ''}`, {
            duration: 8000,
            style: {
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
            },
            icon: '🙋',
          })
          // Play notification sound
          try {
            const audio = new Audio('/notification.wav')
            audio.volume = 0.7
            audio.play().catch(() => {})
          } catch {}
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] staff-call channel:', status)
      })

    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(staffChannel)
    }
  }, []) // Empty deps - supabaseRef.current never changes

  const handleLogout = async () => {
    await supabaseRef.current.auth.signOut()
    toast.success('Đã đăng xuất!')
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <Menu className="w-6 h-6 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <UtensilsCrossed className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-800">Quản trị</span>
        </div>
        <div className="relative">
          <Bell className="w-6 h-6 text-slate-600" />
          {newOrderCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {newOrderCount}
            </span>
          )}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl animate-slide-up p-6 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg text-slate-800">Quản trị</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <nav className="space-y-1 flex-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={isActive(item.href) ? 'sidebar-link-active' : 'sidebar-link'}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <button onClick={handleLogout} className="sidebar-link text-red-500 hover:bg-red-50 hover:text-red-600 mt-4">
              <LogOut className="w-5 h-5" />
              Đăng xuất
            </button>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 flex-col p-6 z-40">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800">Hệ thống gọi món</p>
            <p className="text-xs text-slate-400">Quản trị viên</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? 'sidebar-link-active' : 'sidebar-link'}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.href === '/admin/orders' && newOrderCount > 0 && (
                <span className="ml-auto w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {newOrderCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <button onClick={handleLogout} className="sidebar-link text-red-500 hover:bg-red-50 hover:text-red-600 mt-4">
          <LogOut className="w-5 h-5" />
          Đăng xuất
        </button>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
