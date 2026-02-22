'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Grid3X3, UtensilsCrossed, ClipboardList, DollarSign, Trash2, TrendingUp } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalTables: number
  activeTables: number
  totalProducts: number
  activeOrders: number
  todayRevenue: number
}

type RevenueMode = 'day' | 'week' | 'month'

interface RevenuePoint {
  label: string      // "06:00", "T2", "01/02"…
  revenue: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000
    ? (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
    : n >= 1_000
    ? (n / 1_000).toFixed(0) + 'K'
    : n.toString()

const fmtFull = (n: number) => n.toLocaleString('vi-VN') + 'đ'

function buildDayPoints(rows: { updated_at: string; total_price: number }[]): RevenuePoint[] {
  // Group by hour (0-23) for today
  const map: Record<number, number> = {}
  for (let h = 0; h < 24; h += 2) map[h] = 0   // 0,2,4,...22
  rows.forEach(r => {
    const d = new Date(r.updated_at)
    const h = Math.floor(d.getHours() / 2) * 2
    map[h] = (map[h] ?? 0) + Number(r.total_price)
  })
  return Object.entries(map).map(([h, rev]) => ({
    label: `${String(h).padStart(2, '0')}:00`,
    revenue: rev,
  }))
}

function buildWeekPoints(rows: { updated_at: string; total_price: number }[]): RevenuePoint[] {
  // T2=1, T3=2, T4=3, T5=4, T6=5, T7=6, CN=0  (getDay() convention)
  // Hiển thị theo thứ tự: T2 → T3 → T4 → T5 → T6 → T7 → CN
  const ORDER: { label: string; day: number }[] = [
    { label: 'T2', day: 1 },
    { label: 'T3', day: 2 },
    { label: 'T4', day: 3 },
    { label: 'T5', day: 4 },
    { label: 'T6', day: 5 },
    { label: 'T7', day: 6 },
    { label: 'CN', day: 0 },
  ]
  const map: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  rows.forEach(r => {
    const day = new Date(r.updated_at).getDay()
    map[day] = (map[day] ?? 0) + Number(r.total_price)
  })
  return ORDER.map(({ label, day }) => ({ label, revenue: map[day] }))
}

function buildMonthPoints(rows: { updated_at: string; total_price: number }[]): RevenuePoint[] {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const map: Record<number, number> = {}
  for (let d = 1; d <= daysInMonth; d++) map[d] = 0
  rows.forEach(r => {
    const day = new Date(r.updated_at).getDate()
    map[day] = (map[day] ?? 0) + Number(r.total_price)
  })
  return Object.entries(map).map(([d, rev]) => ({
    label: `${d}`,
    revenue: rev,
  }))
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

function BarChart({ points }: { points: RevenuePoint[] }) {
  const maxRev = Math.max(...points.map(p => p.revenue), 1)
  const W = 100 // viewBox width per bar column (%)
  const BAR_W = 60  // % of column width
  const HEIGHT = 160 // chart area height in px

  // Luôn hiển thị nhãn cho tất cả cột
  const showLabel = (_i: number) => true

  // Mỗi cột tối thiểu 44px để nhãn không bị chồng nhau
  const BAR_COL_W = 44

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: Math.max(points.length * BAR_COL_W, 300) }} className="relative">
        {/* Y-axis grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ bottom: 24 }}>
          {[1, 0.75, 0.5, 0.25, 0].map(frac => (
            <div key={frac} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-300 w-8 text-right flex-shrink-0">
                {frac === 0 ? '0' : fmt(Math.round(maxRev * frac))}
              </span>
              <div className="flex-1 border-t border-dashed border-slate-100" />
            </div>
          ))}
        </div>

        {/* Bars — pt-6 để label trên hover không bị cắt */}
        <div className="flex items-end gap-1 pl-10 pr-2 pt-6" style={{ height: HEIGHT + 28 + 24 }}>
          {points.map((p, i) => {
            const barH = maxRev > 0 ? Math.max((p.revenue / maxRev) * HEIGHT, p.revenue > 0 ? 4 : 0) : 0
            return (
              <div key={i} className="flex flex-col items-center flex-1 group" style={{ minWidth: 36 }}>
                {/* Giá trị hiện khi hover — inline, không bị clip bởi overflow */}
                <span
                  className="text-[9px] font-bold text-orange-500 h-4 flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                >
                  {p.revenue > 0 ? fmt(p.revenue) : '–'}
                </span>
                {/* Bar */}
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: barH,
                    background: p.revenue > 0
                      ? 'linear-gradient(to top, #f97316, #fb923c)'
                      : '#f1f5f9',
                    minHeight: 2,
                  }}
                />
                {/* X label */}
                {showLabel(i) && (
                  <span className="text-[9px] text-slate-400 mt-1 truncate w-full text-center">
                    {p.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTables: 0, activeTables: 0, totalProducts: 0, activeOrders: 0, todayRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)

  // Revenue chart
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('day')
  const [revenuePoints, setRevenuePoints] = useState<RevenuePoint[]>([])
  const [revTotal, setRevTotal] = useState(0)
  const [chartLoading, setChartLoading] = useState(false)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => { fetchStats() }, [])
  useEffect(() => { fetchRevenueChart(revenueMode) }, [revenueMode])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const fetchStats = async () => {
    // Lấy đầu ngày hôm nay theo giờ địa phương (VN UTC+7)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [tablesRes, productsRes, ordersRes, revenueRes] = await Promise.all([
      supabase.from('tables').select('id, status'),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id, status').eq('status', 'serving'),
      supabase
        .from('orders')
        .select('total_price')
        .eq('status', 'paid')
        .gte('updated_at', todayStart),   // ← chỉ lấy đơn paid trong ngày hôm nay
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

  // ── Revenue chart ──────────────────────────────────────────────────────────
  const fetchRevenueChart = async (mode: RevenueMode) => {
    setChartLoading(true)
    const now = new Date()
    let from: Date

    if (mode === 'day') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())          // start of today
    } else if (mode === 'week') {
      // Tính ngày Thứ 2 đầu tuần (tuần bắt đầu từ T2, không phải CN)
      // getDay(): 0=CN, 1=T2...6=T7
      // công thức (day + 6) % 7: 0=CN→6, 1=T2→0, 2=T3→1...6=T7→5
      const dayOfWeek = now.getDay()
      const daysFromMonday = (dayOfWeek + 6) % 7   // số ngày tính từ T2
      from = new Date(now)
      from.setDate(now.getDate() - daysFromMonday)
      from.setHours(0, 0, 0, 0)
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1)                      // start of month
    }

    const { data } = await supabase
      .from('orders')
      .select('updated_at, total_price')
      .eq('status', 'paid')
      .gte('updated_at', from.toISOString())
      .order('updated_at')

    const rows = (data || []) as { updated_at: string; total_price: number }[]
    const total = rows.reduce((s, r) => s + Number(r.total_price), 0)
    setRevTotal(total)

    if (mode === 'day') setRevenuePoints(buildDayPoints(rows))
    else if (mode === 'week') setRevenuePoints(buildWeekPoints(rows))
    else setRevenuePoints(buildMonthPoints(rows))

    setChartLoading(false)
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
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
        fetchRevenueChart(revenueMode)
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

  const modeTabs: { key: RevenueMode; label: string }[] = [
    { key: 'day', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần này' },
    { key: 'month', label: 'Tháng này' },
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

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`card p-6 relative overflow-hidden group`}
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

      {/* ── Revenue Chart ──────────────────────────────────────────────── */}
      <div className="mt-6 card p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Doanh thu</h2>
              <p className="text-xs text-slate-400">Từ các đơn đã thanh toán</p>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {modeTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setRevenueMode(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  revenueMode === tab.key
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Total revenue label */}
        <div className="mb-4">
          <p className="text-3xl font-extrabold text-slate-900">
            {revTotal.toLocaleString('vi-VN')}
            <span className="text-lg font-semibold text-slate-400 ml-1">đ</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Tổng doanh thu {revenueMode === 'day' ? 'hôm nay' : revenueMode === 'week' ? 'tuần này' : 'tháng này'}
          </p>
        </div>

        {/* Chart */}
        {chartLoading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : revenuePoints.every(p => p.revenue === 0) ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-300 gap-2">
            <TrendingUp className="w-12 h-12" />
            <p className="text-sm text-slate-400">Chưa có doanh thu trong khoảng thời gian này</p>
          </div>
        ) : (
          <BarChart points={revenuePoints} />
        )}
      </div>

      {/* ⚡ Database Cleanup Section */}
      <div className="mt-6 card p-5">
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
