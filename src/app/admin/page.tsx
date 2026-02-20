'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Grid3X3, UtensilsCrossed, ClipboardList, DollarSign, Trash2 } from 'lucide-react'

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
  const [cleaning, setCleaning] = useState(false)
  // ⚡ Tạo supabase client 1 lần duy nhất
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    // ⚡ Chỉ SELECT cột cần thiết → giảm bandwidth
    const [tablesRes, productsRes, ordersRes, revenueRes] = await Promise.all([
      supabase.from('tables').select('id, status'),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id, status').eq('status', 'serving'),
      supabase.from('orders').select('total_price').eq('status', 'paid'),
    ])

    const tables = tablesRes.data || []
    const activeOrders = ordersRes.data || []
    const paidOrders = revenueRes.data || []

    setStats({
      totalTables: tables.length,
      activeTables: tables.filter(t => t.status).length,
      totalProducts: productsRes.count || 0,
      activeOrders: activeOrders.length,
      todayRevenue: paidOrders.reduce((sum, o) => sum + Number(o.total_price), 0),
    })
    setLoading(false)
  }

  // ⚡ Dọn dẹp đơn cũ để giữ DB dưới 500 MB (Supabase Free)
  const handleCleanup = async () => {
    if (!confirm('Xóa tất cả đơn hàng đã thanh toán hơn 30 ngày?\nDữ liệu đã xóa không thể khôi phục.')) return
    setCleaning(true)
    try {
      const { data, error } = await supabase.rpc('cleanup_old_orders')
      if (error) {
        toast.error('Lỗi dọn dẹp: ' + error.message)
      } else {
        const result = data as { orders_deleted: number; items_deleted: number }
        if (result.orders_deleted === 0) {
          toast.success('Không có đơn cũ cần dọn dẹp!')
        } else {
          toast.success(`Đã xóa ${result.orders_deleted} đơn và ${result.items_deleted} mục cũ!`)
        }
        fetchStats()
      }
    } catch {
      toast.error('Có lỗi xảy ra!')
    }
    setCleaning(false)
  }

  const statCards = [
    {
      label: 'Bàn hoạt động',
      value: `${stats.activeTables}/${stats.totalTables}`,
      icon: Grid3X3,
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
      label: 'Đơn đang phục vụ',
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

      {/* ⚡ Database Cleanup Section */}
      <div className="mt-8 card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-slate-400" />
              Bảo trì dữ liệu
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              Xóa đơn hàng đã thanh toán trên 30 ngày để tiết kiệm dung lượng
            </p>
          </div>
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 w-fit"
          >
            {cleaning ? (
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {cleaning ? 'Đang dọn...' : 'Dọn dẹp dữ liệu cũ'}
          </button>
        </div>
      </div>
    </div>
  )
}

