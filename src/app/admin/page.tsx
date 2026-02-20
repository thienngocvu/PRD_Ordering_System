'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Grid3X3, UtensilsCrossed, ClipboardList, DollarSign, TrendingUp } from 'lucide-react'

interface DashboardStats {
  totalTables: number
  activeTables: number
  totalProducts: number
  activeOrders: number
  todayRevenue: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTables: 0, activeTables: 0, totalProducts: 0, activeOrders: 0, todayRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const [tablesRes, productsRes, ordersRes, revenueRes] = await Promise.all([
      supabase.from('tables').select('id, status'),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id, status'),
      supabase.from('orders').select('total_price').eq('status', 'paid'),
    ])

    const tables = tablesRes.data || []
    const orders = ordersRes.data || []
    const paidOrders = revenueRes.data || []

    setStats({
      totalTables: tables.length,
      activeTables: tables.filter(t => t.status).length,
      totalProducts: productsRes.count || 0,
      activeOrders: orders.filter(o => o.status === 'pending' || o.status === 'completed').length,
      todayRevenue: paidOrders.reduce((sum, o) => sum + Number(o.total_price), 0),
    })
    setLoading(false)
  }

  const statCards = [
    {
      label: 'Tổng số bàn',
      value: stats.totalTables,
      icon: Grid3X3,
      color: 'from-blue-500 to-blue-600',
      shadow: 'shadow-blue-500/25',
    },
    {
      label: 'Bàn đang phục vụ',
      value: stats.activeTables,
      icon: TrendingUp,
      color: 'from-emerald-500 to-emerald-600',
      shadow: 'shadow-emerald-500/25',
    },
    {
      label: 'Tổng món ăn',
      value: stats.totalProducts,
      icon: UtensilsCrossed,
      color: 'from-orange-500 to-orange-600',
      shadow: 'shadow-orange-500/25',
    },
    {
      label: 'Đơn đang xử lý',
      value: stats.activeOrders,
      icon: ClipboardList,
      color: 'from-purple-500 to-purple-600',
      shadow: 'shadow-purple-500/25',
    },
    {
      label: 'Doanh thu hôm nay',
      value: stats.todayRevenue.toLocaleString('vi-VN') + 'đ',
      icon: DollarSign,
      color: 'from-pink-500 to-rose-600',
      shadow: 'shadow-pink-500/25',
      wide: true,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Tổng quan</h1>
        <p className="text-slate-500 mt-1">Chào mừng trở lại! Đây là tình hình cửa hàng hôm nay.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`card p-6 relative overflow-hidden group ${card.wide ? 'sm:col-span-2 lg:col-span-1' : ''}`}
          >
            <div className={`absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br ${card.color} rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300`} />
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} ${card.shadow} shadow-lg flex items-center justify-center`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
