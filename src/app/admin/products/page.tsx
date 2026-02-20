'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category } from '@/lib/types'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { Plus, Pencil, Trash2, X, Upload, UtensilsCrossed, Search } from 'lucide-react'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', price: '', category_id: 0, is_available: true })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [productsRes, categoriesRes] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('priority'),
    ])
    setProducts(productsRes.data || [])
    setCategories(categoriesRes.data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditingProduct(null)
    setForm({ name: '', price: '', category_id: categories[0]?.id || 0, is_available: true })
    setImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setForm({ name: p.name, price: String(p.price), category_id: p.category_id, is_available: p.is_available })
    setImageFile(null)
    setImagePreview(p.image_url)
    setShowModal(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file)
    if (error) {
      toast.error('Lỗi upload ảnh!')
      return null
    }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName)
    return urlData.publicUrl
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || !form.category_id) return
    setSaving(true)

    let imageUrl = editingProduct?.image_url || null

    if (imageFile) {
      const url = await uploadImage(imageFile)
      if (url) imageUrl = url
    }

    const productData = {
      name: form.name.trim(),
      price: parseFloat(form.price),
      category_id: form.category_id,
      is_available: form.is_available,
      image_url: imageUrl,
    }

    if (editingProduct) {
      const { error } = await supabase.from('products').update(productData).eq('id', editingProduct.id)
      if (error) toast.error('Lỗi cập nhật!')
      else toast.success('Đã cập nhật món ăn!')
    } else {
      const { error } = await supabase.from('products').insert(productData)
      if (error) toast.error('Lỗi thêm món ăn!')
      else toast.success('Đã thêm món ăn mới!')
    }

    setSaving(false)
    setShowModal(false)
    fetchData()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn chắc chắn muốn xóa món này?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) toast.error('Không thể xóa món ăn!')
    else { toast.success('Đã xóa món ăn!'); fetchData() }
  }

  const toggleAvailability = async (p: Product) => {
    await supabase.from('products').update({ is_available: !p.is_available }).eq('id', p.id)
    fetchData()
    toast.success(p.is_available ? 'Đã đánh dấu hết hàng' : 'Đã đánh dấu còn hàng')
  }

  const getCategoryName = (id: number) => categories.find(c => c.id === id)?.name || '—'

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = filterCategory === 0 || p.category_id === filterCategory
    return matchSearch && matchCategory
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Quản lý món ăn</h1>
          <p className="text-slate-500 mt-1">{products.length} món ăn</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 w-fit">
          <Plus className="w-5 h-5" />
          Thêm món
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm món ăn..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(Number(e.target.value))}
          className="input-field w-full sm:w-48"
        >
          <option value={0}>Tất cả danh mục</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map(product => (
          <div key={product.id} className={`card overflow-hidden group ${!product.is_available ? 'opacity-60' : ''}`}>
            <div className="relative h-40 bg-slate-100">
              {product.image_url ? (
                <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <UtensilsCrossed className="w-10 h-10 text-slate-300" />
                </div>
              )}
              {!product.is_available && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">Hết hàng</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-xs text-orange-500 font-semibold mb-1">{getCategoryName(product.category_id)}</p>
              <h3 className="font-bold text-slate-800 mb-1">{product.name}</h3>
              <p className="text-lg font-bold text-orange-600">{Number(product.price).toLocaleString('vi-VN')}đ</p>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => toggleAvailability(product)} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${product.is_available ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>
                  {product.is_available ? 'Còn hàng' : 'Bật lại'}
                </button>
                <button onClick={() => openEdit(product)} className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(product.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full text-center py-16 card">
            <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-lg">Không tìm thấy món ăn</p>
          </div>
        )}
      </div>

      {/* Modal: Add/Edit Product */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-slide-up my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingProduct ? 'Sửa món ăn' : 'Thêm món ăn'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Hình ảnh</label>
                <div className="relative h-40 bg-slate-100 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 hover:border-orange-400 transition-colors cursor-pointer group">
                  <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  {imagePreview ? (
                    <Image src={imagePreview} alt="Preview" fill className="object-cover" sizes="400px" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 group-hover:text-orange-500 transition-colors">
                      <Upload className="w-8 h-8 mb-2" />
                      <span className="text-sm">Chọn ảnh món ăn</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tên món</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Phở bò, Cơm gà..." className="input-field" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Giá (VNĐ)</label>
                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="50000" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Danh mục</label>
                <select value={form.category_id} onChange={e => setForm({ ...form, category_id: Number(e.target.value) })} className="input-field">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_available" checked={form.is_available} onChange={e => setForm({ ...form, is_available: e.target.checked })} className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500" />
                <label htmlFor="is_available" className="text-sm text-slate-700">Còn hàng</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary">Hủy</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.price} className="flex-1 btn-primary">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
