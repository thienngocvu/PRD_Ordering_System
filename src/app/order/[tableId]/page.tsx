'use client'

import { useEffect, useRef, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Table, CategoryWithProducts, CartItem, Order } from '@/lib/types'
import Image from 'next/image'
import toast from 'react-hot-toast'
import {
  UtensilsCrossed, ShoppingCart, Plus, Minus, Trash2, X,
  Send, User, ChefHat, CheckCircle, MessageSquare, Bell
} from 'lucide-react'

export default function OrderPage({ params }: { params: Promise<{ tableId: string }> }) {
  const resolvedParams = use(params)
  const tableId = Number(resolvedParams.tableId)
  const [table, setTable] = useState<Table | null>(null)
  const [categories, setCategories] = useState<CategoryWithProducts[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [showNameModal, setShowNameModal] = useState(true)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [activeCategory, setActiveCategory] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({})
  // ⚡ Tạo supabase client 1 lần duy nhất, không tái tạo mỗi render
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    // Try to get from URL params first (redirected from booking page)
    const params = new URLSearchParams(window.location.search)
    const qName = params.get('name')
    const qPhone = params.get('phone')
    
    // Fallback to localStorage
    const storedName = localStorage.getItem(`booking_name_${tableId}`)
    const storedPhone = localStorage.getItem(`booking_phone_${tableId}`)
    
    // finalPhone can be empty
    const finalName = qName || storedName || ''
    const finalPhone = qPhone || storedPhone || ''
    
    if (finalName) {
      setCustomerName(finalName)
      setCustomerPhone(finalPhone)
      setShowNameModal(false)
      localStorage.removeItem(`booking_name_${tableId}`)
      localStorage.removeItem(`booking_phone_${tableId}`)
    }
  }, [tableId])

  useEffect(() => {
    if (!showNameModal && customerName) {
      fetchData()
    }
  }, [showNameModal, customerName])

  const fetchData = async () => {
    // ⚡ Chỉ SELECT cột cần thiết → giảm bandwidth Supabase (2 GB free/tháng)
    const { data: tableData } = await supabase
      .from('tables')
      .select('id, table_number, status, current_order_id')
      .eq('id', tableId)
      .single()

    if (!tableData) {
      setTable(null)
      setLoading(false)
      return
    }
    setTable(tableData as Table)

    // Fetch menu - chỉ lấy cột cần thiết
    const { data: catData } = await supabase
      .from('categories')
      .select('id, name, priority, products(id, name, price, image_url, is_available, category_id)')
      .order('priority')

    if (catData) {
      const filtered = catData.map(cat => ({
        ...cat,
        products: (cat.products || []).filter((p: { is_available: boolean }) => p.is_available),
      })).filter(cat => cat.products.length > 0)

      setCategories(filtered as CategoryWithProducts[])
      if (filtered.length > 0) setActiveCategory(filtered[0].id)
    }

    // Check existing order on this table
    if (tableData.status && tableData.current_order_id) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, table_id, customer_name, total_price, status, created_at, updated_at')
        .eq('id', tableData.current_order_id)
        .single()
      if (orderData) setCurrentOrder(orderData as Order)
    }

    setLoading(false)
  }

  const addToCart = (product: CategoryWithProducts['products'][0]) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { product, quantity: 1, note: '' }]
    })
    toast.success(`Đã thêm ${product.name}`, { duration: 1500 })
  }

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta
          if (newQty <= 0) return null as unknown as CartItem
          return { ...item, quantity: newQty }
        }
        return item
      }).filter(Boolean)
    })
  }

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
  }

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return
    setSubmitting(true)

    try {
      let orderId = currentOrder?.id

      // If no active order, check-in via server function (handles concurrency)
      if (!orderId) {
        const { data: checkinResult, error: checkinError } = await supabase
          .rpc('checkin_and_create_order', {
            p_table_id: tableId,
            p_customer_name: customerName,
            p_customer_phone: customerPhone,
          })

        if (checkinError || !checkinResult || checkinResult.error) {
          toast.error(checkinResult?.error || 'Không thể tạo đơn hàng!')
          setSubmitting(false)
          return
        }

        orderId = checkinResult.order_id
        setCurrentOrder({ id: orderId, table_id: tableId, customer_name: customerName, total_price: 0, status: 'serving', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Order)
      }

      // Add items via server function (validates prices server-side)
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        note: itemNotes[item.product.id] || null,
      }))

      const { data: addResult, error: addError } = await supabase
        .rpc('add_items_to_order', {
          p_order_id: orderId!,
          p_items: items,
        })

      if (addError || !addResult || addResult.error) {
        toast.error(addResult?.error || 'Lỗi khi gửi đơn!')
        setSubmitting(false)
        return
      }

      setCart([])
      setItemNotes({})
      setShowCart(false)
      setOrderSuccess(true)
      setTimeout(() => setOrderSuccess(false), 4000)
      toast.success('Đã gửi đơn hàng thành công!')
      fetchData()
    } catch {
      toast.error('Có lỗi xảy ra!')
    }

    setSubmitting(false)
  }

  // Name input modal
  if (showNameModal) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl shadow-xl shadow-orange-500/30 mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Xin chào!</h1>
            <p className="text-slate-500 mt-1">Vui lòng cho biết tên của bạn</p>
          </div>
          <div className="card p-6">
            <input
              type="text"
              placeholder="Nhập tên của bạn..."
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="input-field mb-3 text-center text-lg"
              autoFocus
            />
            <input
              type="tel"
              placeholder="Nhập số điện thoại (Không bắt buộc)..."
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customerName.trim()) {
                  setShowNameModal(false)
                }
              }}
              className="input-field mb-4 text-center text-lg"
            />
            <button
              onClick={() => { if (customerName.trim()) setShowNameModal(false) }}
              disabled={!customerName.trim()}
              className="w-full btn-primary py-3"
            >
              Bắt đầu gọi món
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </main>
    )
  }

  if (!table) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-6xl mb-4">😥</p>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Bàn không tồn tại</h1>
          <p className="text-slate-500">Vui lòng kiểm tra lại mã QR</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-900">{table.table_number}</h1>
            <p className="text-xs text-slate-400">
              Xin chào, {customerName}! 👋 {customerPhone && `(${customerPhone})`}
            </p>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="relative p-2 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors"
          >
            <ShoppingCart className="w-6 h-6 text-orange-600" />
            {getTotalItems() > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-bounce">
                {getTotalItems()}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Order Success Banner */}
      {orderSuccess && (
        <div className="mx-4 mt-4 max-w-lg lg:mx-auto">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 animate-slide-up">
            <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800">Đã gửi đơn thành công!</p>
              <p className="text-sm text-emerald-600">Bếp đang chuẩn bị món cho bạn...</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 mt-4">
        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-4">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-orange-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Items */}
        <div className="space-y-3">
          {categories
            .filter(cat => activeCategory === 0 || cat.id === activeCategory)
            .map(cat => (
              <div key={cat.id}>
                <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-orange-500" />
                  {cat.name}
                </h2>
                <div className="space-y-3">
                  {cat.products.map(product => {
                    const cartItem = cart.find(item => item.product.id === product.id)
                    return (
                      <div key={product.id} className="card p-3 flex gap-3">
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                          {product.image_url ? (
                            <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="80px" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <UtensilsCrossed className="w-6 h-6 text-slate-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-800 text-sm">{product.name}</h3>
                          <p className="text-orange-600 font-bold mt-1">
                            {Number(product.price).toLocaleString('vi-VN')}đ
                          </p>
                          {cartItem ? (
                            <div className="flex items-center gap-2 mt-2">
                              <button onClick={() => updateQuantity(product.id, -1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-bold text-sm w-6 text-center">{cartItem.quantity}</span>
                              <button onClick={() => updateQuantity(product.id, 1)} className="w-7 h-7 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(product)} className="mt-2 text-xs bg-orange-50 text-orange-600 hover:bg-orange-100 px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" />
                              Thêm
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Floating Cart Button */}
      {getTotalItems() > 0 && !showCart && (
        <div className="fixed bottom-6 left-4 right-4 max-w-lg mx-auto z-30 animate-slide-up">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl p-4 shadow-xl shadow-orange-500/30 flex items-center justify-between transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6" />
              <span className="font-bold">{getTotalItems()} món</span>
            </div>
            <span className="font-bold text-lg">{getTotalPrice().toLocaleString('vi-VN')}đ</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 px-6 pt-6 pb-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Giỏ hàng ({getTotalItems()} món)</h2>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-10">
                  <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">Giỏ hàng trống</p>
                </div>
              ) : (
                <>
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800 text-sm">{item.product.name}</p>
                        <p className="text-orange-600 font-bold text-sm">
                          {Number(item.product.price).toLocaleString('vi-VN')}đ
                        </p>
                        {/* Note input */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <input
                            type="text"
                            placeholder="Ghi chú (ít đá, cay...)"
                            value={itemNotes[item.product.id] || ''}
                            onChange={e => setItemNotes({ ...itemNotes, [item.product.id]: e.target.value })}
                            className="text-xs bg-transparent border-b border-slate-200 focus:border-orange-400 outline-none py-0.5 flex-1 text-slate-600"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-sm w-5 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-bold text-slate-900">Tổng cộng</span>
                      <span className="text-2xl font-bold text-orange-600">{getTotalPrice().toLocaleString('vi-VN')}đ</span>
                    </div>
                    <button
                      onClick={handleSubmitOrder}
                      disabled={submitting || cart.length === 0}
                      className="w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Gửi đơn hàng
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Call Staff Button */}
      <button
        onClick={async () => {
          const staffChannel = supabase.channel('staff-call')
          await staffChannel.subscribe()
          await staffChannel.send({
            type: 'broadcast',
            event: 'call-staff',
            payload: {
              tableName: table?.table_number || `Bàn #${tableId}`,
              customerName: customerName,
              customerPhone: customerPhone,
            },
          })
          supabase.removeChannel(staffChannel)
          toast.success('Đã gọi nhân viên! Vui lòng đợi...', { icon: '🔔', duration: 5000 })
        }}
        className="fixed bottom-6 right-4 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-4 py-3 rounded-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-95 z-20"
        title="Gọi nhân viên"
      >
        <Bell className="w-5 h-5 flex-shrink-0" />
        <span className="font-semibold text-sm whitespace-nowrap">Gọi nhân viên</span>
      </button>
    </main>
  )
}
