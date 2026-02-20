'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrderWithItems, OrderStatus, Table, Product, Category } from '@/lib/types'
import toast from 'react-hot-toast'
import {
  ClipboardList, CreditCard, ChefHat, Eye, X,
  Plus, Trash2, Minus, Edit3, Search
} from 'lucide-react'

const statusLabels: Record<OrderStatus, string> = {
  serving: 'Đang phục vụ',
  paid: 'Đã thanh toán',
}

const statusBadgeClass: Record<OrderStatus, string> = {
  serving: 'badge-serving',
  paid: 'badge-paid',
}

// =========================================
// TYPES
// =========================================
interface NewOrderItem {
  product: Product
  quantity: number
  note: string
}

type ModalMode = null | 'view' | 'create' | 'edit' | 'add-items'

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)

  // Create / Edit states
  const [tables, setTables] = useState<Table[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedTableId, setSelectedTableId] = useState<number>(0)
  const [customerName, setCustomerName] = useState('')
  const [cartItems, setCartItems] = useState<NewOrderItem[]>([])
  const [searchProduct, setSearchProduct] = useState('')
  const [activeCategory, setActiveCategory] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // ⚡ Debounce fetchOrders để tránh refetch liên tục khi nhiều sự kiện Realtime đến cùng lúc
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedFetchOrders = useCallback(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
    fetchTimeoutRef.current = setTimeout(() => fetchOrders(), 500)
  }, [])

  useEffect(() => {
    fetchOrders()

    // ⚡ Gộp 2 listeners (orders + order_items) vào 1 channel → tiết kiệm Realtime messages
    const channel = supabase
      .channel('orders-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => debouncedFetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => debouncedFetchOrders())
      .subscribe()

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
      supabase.removeChannel(channel)
    }
  }, [debouncedFetchOrders])

  // =========================================
  // DATA FETCH (⚡ Chỉ SELECT cột cần thiết → giảm bandwidth)
  // =========================================
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, table_id, customer_name, total_price, status, created_at,
        table:tables!orders_table_id_fkey(id, table_number),
        order_items(id, product_id, quantity, price_at_time, note, status,
          product:products(id, name, price)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50) // ⚡ Giới hạn 50 đơn mới nhất
    if (error) console.error('[fetchOrders] Error:', error)
    setOrders((data as unknown as OrderWithItems[]) || [])
    setLoading(false)
  }

  const fetchTablesAndProducts = async () => {
    const [tablesRes, productsRes, catsRes] = await Promise.all([
      supabase.from('tables').select('id, table_number, status').order('table_number'),
      supabase.from('products').select('id, name, price, category_id').eq('is_available', true).order('name'),
      supabase.from('categories').select('id, name, priority').order('priority'),
    ])
    setTables((tablesRes.data || []) as Table[])
    setProducts((productsRes.data || []) as Product[])
    setCategories((catsRes.data || []) as Category[])
  }

  // =========================================
  // CRUD ACTIONS
  // =========================================

  // CREATE
  const openCreateModal = async () => {
    await fetchTablesAndProducts()
    setSelectedTableId(0)
    setCustomerName('')
    setCartItems([])
    setSearchProduct('')
    setActiveCategory(0)
    setModalMode('create')
  }

  const handleCreateOrder = async () => {
    if (!selectedTableId || cartItems.length === 0) {
      toast.error('Vui lòng chọn bàn và thêm ít nhất 1 món!')
      return
    }
    setSubmitting(true)
    try {
      // Create order
      const totalPrice = cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: selectedTableId,
          customer_name: customerName || null,
          total_price: totalPrice,
          status: 'serving' as OrderStatus,
          created_by: 'admin',
        })
        .select()
        .single()

      if (orderError || !newOrder) {
        toast.error('Lỗi tạo đơn hàng: ' + (orderError?.message || ''))
        setSubmitting(false)
        return
      }

      // Insert items
      const items = cartItems.map(i => ({
        order_id: newOrder.id,
        product_id: i.product.id,
        quantity: i.quantity,
        price_at_time: i.product.price,
        note: i.note || null,
      }))
      const { error: itemsError } = await supabase.from('order_items').insert(items)
      if (itemsError) {
        toast.error('Lỗi thêm món: ' + itemsError.message)
        setSubmitting(false)
        return
      }

      // Update table status
      await supabase.from('tables').update({
        status: true,
        current_order_id: newOrder.id,
      }).eq('id', selectedTableId)

      toast.success('Đã tạo đơn hàng mới!')
      setModalMode(null)
      fetchOrders()
    } catch {
      toast.error('Có lỗi xảy ra!')
    }
    setSubmitting(false)
  }

  // UPDATE STATUS
  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
    if (error) {
      toast.error('Lỗi cập nhật trạng thái!')
      return
    }

    if (status === 'paid') {
      const order = orders.find(o => o.id === orderId)
      if (order) {
        await supabase.from('tables').update({ status: false, current_order_id: null }).eq('id', order.table_id)
      }
    }

    toast.success(`Đã chuyển sang: ${statusLabels[status]}`)
    fetchOrders()
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status } : null)
    }
  }

  // UPDATE ITEM STATUS
  const updateItemStatus = async (itemId: number, status: string) => {
    await supabase.from('order_items').update({ status }).eq('id', itemId)
    toast.success('Đã cập nhật trạng thái món!')
    fetchOrders()
  }

  // ADD ITEMS to existing order
  const openAddItemsModal = async (order: OrderWithItems) => {
    await fetchTablesAndProducts()
    setSelectedOrder(order)
    setCartItems([])
    setSearchProduct('')
    setActiveCategory(0)
    setModalMode('add-items')
  }

  const handleAddItemsToOrder = async () => {
    if (!selectedOrder || cartItems.length === 0) return
    setSubmitting(true)
    try {
      const items = cartItems.map(i => ({
        order_id: selectedOrder.id,
        product_id: i.product.id,
        quantity: i.quantity,
        price_at_time: i.product.price,
        note: i.note || null,
      }))
      const { error } = await supabase.from('order_items').insert(items)
      if (error) {
        toast.error('Lỗi thêm món!')
        setSubmitting(false)
        return
      }

      // Update total
      const addedTotal = cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
      const newTotal = selectedOrder.total_price + addedTotal
      await supabase.from('orders').update({ total_price: newTotal }).eq('id', selectedOrder.id)

      toast.success('Đã thêm món vào đơn!')
      setModalMode(null)
      setSelectedOrder(null)
      fetchOrders()
    } catch {
      toast.error('Có lỗi xảy ra!')
    }
    setSubmitting(false)
  }

  // DELETE ORDER ITEM
  const deleteOrderItem = async (order: OrderWithItems, itemId: number) => {
    if (!confirm('Xóa món này khỏi đơn hàng?')) return
    const item = order.order_items.find(i => i.id === itemId)
    if (!item) return

    const { error } = await supabase.from('order_items').delete().eq('id', itemId)
    if (error) {
      toast.error('Lỗi xóa món!')
      return
    }

    // Recalculate total
    const newTotal = order.total_price - (item.price_at_time * item.quantity)
    await supabase.from('orders').update({ total_price: Math.max(0, newTotal) }).eq('id', order.id)

    toast.success('Đã xóa món!')
    fetchOrders()

    // Update selected order in modal
    if (selectedOrder?.id === order.id) {
      const updated = {
        ...selectedOrder,
        order_items: selectedOrder.order_items.filter(i => i.id !== itemId),
        total_price: Math.max(0, newTotal),
      }
      setSelectedOrder(updated)
    }
  }

  // DELETE ORDER
  const deleteOrder = async (order: OrderWithItems) => {
    if (!confirm(`Xóa đơn hàng tại ${order.table?.table_number || 'bàn'}? Tất cả các món sẽ bị xóa.`)) return

    // Delete items first (FK constraint)
    await supabase.from('order_items').delete().eq('order_id', order.id)
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    if (error) {
      toast.error('Lỗi xóa đơn hàng!')
      return
    }

    // Release table
    await supabase.from('tables').update({ status: false, current_order_id: null }).eq('id', order.table_id)

    toast.success('Đã xóa đơn hàng!')
    setModalMode(null)
    setSelectedOrder(null)
    fetchOrders()
  }

  // =========================================
  // CART HELPERS
  // =========================================
  const addToCart = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product, quantity: 1, note: '' }]
    })
  }

  const updateCartQuantity = (productId: number, delta: number) => {
    setCartItems(prev => prev.map(i => {
      if (i.product.id === productId) {
        const newQty = i.quantity + delta
        return newQty <= 0 ? null! : { ...i, quantity: newQty }
      }
      return i
    }).filter(Boolean))
  }

  const updateCartNote = (productId: number, note: string) => {
    setCartItems(prev => prev.map(i => i.product.id === productId ? { ...i, note } : i))
  }

  const removeFromCart = (productId: number) => {
    setCartItems(prev => prev.filter(i => i.product.id !== productId))
  }

  const calculateTotal = (order: OrderWithItems) => {
    return order.order_items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0)
  }

  const cartTotal = cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0)

  // =========================================
  // FILTER
  // =========================================
  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  // Product list filtered by search and category
  const filteredProducts = products.filter(p => {
    const matchSearch = searchProduct
      ? p.name.toLowerCase().includes(searchProduct.toLowerCase())
      : true
    const matchCat = activeCategory ? p.category_id === activeCategory : true
    return matchSearch && matchCat
  })

  // =========================================
  // RENDER
  // =========================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Quản lý đơn hàng</h1>
          <p className="text-slate-500 mt-1">{orders.length} đơn hàng · Cập nhật thời gian thực</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 w-fit">
          <Plus className="w-5 h-5" />
          Tạo đơn hàng
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['all', 'serving', 'paid'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${filter === f
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {f === 'all' ? 'Tất cả' : statusLabels[f]}
            {f !== 'all' && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-md text-xs">
                {orders.filter(o => o.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map(order => (
          <div key={order.id} className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  order.status === 'serving' ? 'bg-orange-100' : 'bg-blue-100'
                }`}>
                  {order.status === 'serving' ? <ChefHat className="w-5 h-5 text-orange-600" /> :
                   <CreditCard className="w-5 h-5 text-blue-600" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800">{order.table?.table_number || `Bàn #${order.table_id}`}</h3>
                    <span className={statusBadgeClass[order.status]}>{statusLabels[order.status]}</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    {order.customer_name && <span className="text-slate-600 font-medium">{order.customer_name} · </span>}
                    {new Date(order.created_at).toLocaleString('vi-VN')} · {order.order_items.length} món
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-orange-600">
                  {calculateTotal(order).toLocaleString('vi-VN')}đ
                </span>
                <button
                  onClick={() => { setSelectedOrder(order); setModalMode('view') }}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                  title="Xem chi tiết"
                >
                  <Eye className="w-5 h-5" />
                </button>
                {order.status === 'serving' && (
                  <>
                    <button onClick={() => openAddItemsModal(order)} className="p-2 hover:bg-orange-50 rounded-xl text-orange-400" title="Thêm món">
                      <Plus className="w-5 h-5" />
                    </button>
                    <button onClick={() => updateOrderStatus(order.id, 'paid')} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" />
                      Thanh toán
                    </button>
                  </>
                )}
                <button
                  onClick={() => deleteOrder(order)}
                  className="p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-colors"
                  title="Xóa đơn"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick item list */}
            <div className="flex flex-wrap gap-2 mt-2">
              {order.order_items.slice(0, 5).map(item => (
                <span key={item.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                  {item.product?.name} x{item.quantity}
                </span>
              ))}
              {order.order_items.length > 5 && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">
                  +{order.order_items.length - 5} món khác
                </span>
              )}
            </div>
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="text-center py-16 card">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-lg">Không có đơn hàng nào</p>
          </div>
        )}
      </div>

      {/* ================================================ */}
      {/* MODAL: View Order Detail */}
      {/* ================================================ */}
      {modalMode === 'view' && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setModalMode(null); setSelectedOrder(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Chi tiết đơn hàng</h2>
                <p className="text-sm text-slate-400">{selectedOrder.table?.table_number} · {selectedOrder.customer_name || 'Khách'}</p>
              </div>
              <button onClick={() => { setModalMode(null); setSelectedOrder(null) }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {selectedOrder.order_items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{item.product?.name}</p>
                    <p className="text-sm text-slate-400">
                      {Number(item.price_at_time).toLocaleString('vi-VN')}đ × {item.quantity}
                      {item.note && <span className="ml-2 text-orange-500">📝 {item.note}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">
                      {(item.price_at_time * item.quantity).toLocaleString('vi-VN')}đ
                    </span>
                    {selectedOrder.status === 'serving' && (
                      <>
                        <button
                          onClick={() => updateItemStatus(item.id, item.status === 'serving' ? 'done' : 'serving')}
                          className={`text-xs px-2 py-1 rounded-lg font-medium ${
                            item.status === 'done'
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-amber-100 text-amber-600'
                          }`}
                        >
                          {item.status === 'done' ? 'Xong' : 'Đang nấu'}
                        </button>
                        <button
                          onClick={() => deleteOrderItem(selectedOrder, item.id)}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                          title="Xóa món"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">Tổng cộng</span>
              <span className="text-2xl font-bold text-orange-600">
                {calculateTotal(selectedOrder).toLocaleString('vi-VN')}đ
              </span>
            </div>

            <div className="flex gap-3 mt-6">
              {selectedOrder.status === 'serving' && (
                <>
                  <button onClick={() => openAddItemsModal(selectedOrder)} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" />
                    Thêm món
                  </button>
                  <button onClick={() => { updateOrderStatus(selectedOrder.id, 'paid'); setModalMode(null); setSelectedOrder(null) }} className="flex-1 btn-primary flex items-center justify-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Thanh toán
                  </button>
                </>
              )}
              <button
                onClick={() => { deleteOrder(selectedOrder) }}
                className="btn-danger flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================ */}
      {/* MODAL: Create Order / Add Items */}
      {/* ================================================ */}
      {(modalMode === 'create' || modalMode === 'add-items') && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => { setModalMode(null); setSelectedOrder(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 animate-slide-up" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {modalMode === 'create' ? 'Tạo đơn hàng mới' : `Thêm món — ${selectedOrder?.table?.table_number}`}
                </h2>
                {modalMode === 'add-items' && selectedOrder && (
                  <p className="text-sm text-slate-400 mt-0.5">Khách: {selectedOrder.customer_name || 'Không tên'}</p>
                )}
              </div>
              <button onClick={() => { setModalMode(null); setSelectedOrder(null) }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6">
              {/* Table & Customer (only for Create) */}
              {modalMode === 'create' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Bàn *</label>
                    <select
                      value={selectedTableId}
                      onChange={e => setSelectedTableId(Number(e.target.value))}
                      className="select-field"
                    >
                      <option value={0}>Chọn bàn...</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id} disabled={t.status}>
                          {t.table_number} {t.status ? '(đang phục vụ)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tên khách</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Tùy chọn..."
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              {/* Product Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                  placeholder="Tìm món ăn..."
                  className="input-field pl-10"
                />
              </div>

              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
                <button
                  onClick={() => setActiveCategory(0)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeCategory === 0 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto mb-6 pr-1">
                {filteredProducts.map(product => {
                  const inCart = cartItems.find(i => i.product.id === product.id)
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`text-left p-3 rounded-xl border transition-all hover:shadow-sm ${
                        inCart ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                      <p className="text-xs text-orange-600 font-bold mt-0.5">{Number(product.price).toLocaleString('vi-VN')}đ</p>
                      {inCart && (
                        <span className="text-xs text-orange-500 font-semibold">x{inCart.quantity}</span>
                      )}
                    </button>
                  )
                })}
                {filteredProducts.length === 0 && (
                  <p className="col-span-full text-center text-slate-400 py-6 text-sm">Không tìm thấy món ăn</p>
                )}
              </div>

              {/* Cart Items */}
              {cartItems.length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Danh sách món ({cartItems.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {cartItems.map(item => (
                      <div key={item.product.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.product.name}</p>
                          <p className="text-xs text-orange-600 font-bold">{Number(item.product.price).toLocaleString('vi-VN')}đ</p>
                          <input
                            type="text"
                            value={item.note}
                            onChange={e => updateCartNote(item.product.id, e.target.value)}
                            placeholder="Ghi chú..."
                            className="text-xs mt-1 w-full bg-transparent border-b border-slate-200 focus:border-orange-400 outline-none py-0.5 text-slate-500"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateCartQuantity(item.product.id, -1)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.product.id, 1)} className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-slate-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
                    <span className="font-bold text-slate-900">Tổng cộng</span>
                    <span className="text-xl font-bold text-orange-600">{cartTotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setModalMode(null); setSelectedOrder(null) }} className="flex-1 btn-secondary">
                  Hủy
                </button>
                <button
                  onClick={modalMode === 'create' ? handleCreateOrder : handleAddItemsToOrder}
                  disabled={submitting || cartItems.length === 0 || (modalMode === 'create' && !selectedTableId)}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {modalMode === 'create' ? <Plus className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                      {modalMode === 'create' ? 'Tạo đơn hàng' : 'Thêm món'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
