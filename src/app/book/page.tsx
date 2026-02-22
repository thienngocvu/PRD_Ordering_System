'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Table } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { UtensilsCrossed, Grid3X3, User, Phone } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BookingPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    fetchEmptyTables()
  }, [])

  const fetchEmptyTables = async () => {
    // Only fetch tables that are currently not occupied
    const { data } = await supabase
      .from('tables')
      .select('id, table_number, status')
      .eq('status', false)
      .order('table_number')
      
    setTables((data || []) as Table[])
    setLoading(false)
  }

  const handleStartBooking = async () => {
    if (!selectedTable) return
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Vui lòng điền đầy đủ Tên và Số điện thoại!')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.rpc('create_booking', {
      p_table_id: selectedTable.id,
      p_name: customerName.trim(),
      p_phone: customerPhone.trim(),
    })
    
    setLoading(false)

    if (error || data?.error) {
      toast.error(data?.error || 'Không thể đặt bàn!')
      fetchEmptyTables()
      setSelectedTable(null)
      return
    }
    
    // Store in localStorage so order page can pick it up or pass via URL
    if (typeof window !== 'undefined') {
      localStorage.setItem(`booking_name_${selectedTable.id}`, customerName.trim())
      localStorage.setItem(`booking_phone_${selectedTable.id}`, customerPhone.trim())
    }
    
    router.push(`/order/${selectedTable.id}?name=${encodeURIComponent(customerName.trim())}&phone=${encodeURIComponent(customerPhone.trim())}`)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden animate-slide-up border border-white/50">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('/pattern.png')] bg-repeat" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl">
              <UtensilsCrossed className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold mb-2 text-white drop-shadow-sm">Đặt Bàn Mới</h1>
            <p className="text-orange-100 font-medium">Bắt đầu gọi món cho bàn của bạn</p>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                <User className="w-4 h-4 text-orange-500" /> Tên của bạn
              </label>
              <input
                type="text"
                placeholder="Nhập tên người dặt..."
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl px-4 py-3 text-slate-700 placeholder:text-slate-400 outline-none transition-all shadow-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                <Phone className="w-4 h-4 text-orange-500" /> Số điện thoại
              </label>
              <input
                type="tel"
                placeholder="Nhập số điện thoại..."
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl px-4 py-3 text-slate-700 placeholder:text-slate-400 outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-orange-500" /> Chọn bàn trống ({tables.length})
            </label>
            
            {tables.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500 font-medium">Hiện tại không còn bàn trống nào.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                {tables.map(table => (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTable(table)}
                    className={`p-3 rounded-2xl border-2 transition-all font-bold ${
                      selectedTable?.id === table.id
                        ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-md shadow-orange-500/20 scale-105'
                        : 'border-slate-100 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-500 active:scale-95'
                    }`}
                  >
                    Bàn {table.table_number}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleStartBooking}
            disabled={!selectedTable || !customerName.trim() || !customerPhone.trim()}
            className="w-full btn-primary py-4 text-base font-bold shadow-xl shadow-orange-500/30 disabled:opacity-50 disabled:shadow-none"
          >
            Vào Xem Menu & Đặt Món
          </button>
        </div>
      </div>
    </main>
  )
}
