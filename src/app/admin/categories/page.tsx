'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/types'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, X, GripVertical, FolderKanban } from 'lucide-react'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', priority: 0 })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => { fetchCategories() }, [])

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('priority', { ascending: true })
    setCategories(data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditingCategory(null)
    setForm({ name: '', priority: categories.length })
    setShowModal(true)
  }

  const openEdit = (cat: Category) => {
    setEditingCategory(cat)
    setForm({ name: cat.name, priority: cat.priority })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update({ name: form.name.trim(), priority: form.priority })
        .eq('id', editingCategory.id)
      if (error) toast.error('Lỗi cập nhật!')
      else toast.success('Đã cập nhật danh mục!')
    } else {
      const { error } = await supabase
        .from('categories')
        .insert({ name: form.name.trim(), priority: form.priority })
      if (error) toast.error('Lỗi thêm danh mục!')
      else toast.success('Đã thêm danh mục mới!')
    }

    setSaving(false)
    setShowModal(false)
    fetchCategories()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa danh mục sẽ xóa tất cả món ăn trong đó. Tiếp tục?')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) toast.error('Không thể xóa danh mục!')
    else { toast.success('Đã xóa danh mục!'); fetchCategories() }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Danh mục món ăn</h1>
          <p className="text-slate-500 mt-1">Phân loại món ăn theo nhóm</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 w-fit">
          <Plus className="w-5 h-5" />
          Thêm danh mục
        </button>
      </div>

      <div className="card overflow-hidden">
        {categories.length === 0 ? (
          <div className="text-center py-16">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-lg">Chưa có danh mục nào</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group">
                <GripVertical className="w-5 h-5 text-slate-300" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{cat.name}</p>
                  <p className="text-sm text-slate-400">Ưu tiên: {cat.priority}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(cat)} className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors text-slate-400">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors text-slate-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingCategory ? 'Sửa danh mục' : 'Thêm danh mục'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tên danh mục</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ví dụ: Khai vị, Món chính..."
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Thứ tự ưu tiên</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary">Hủy</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 btn-primary">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
