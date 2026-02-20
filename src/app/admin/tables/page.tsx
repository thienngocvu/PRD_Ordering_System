'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Table } from '@/lib/types'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { Plus, Trash2, QrCode, X, Download, Printer, Grid3X3 } from 'lucide-react'

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showQR, setShowQR] = useState<Table | null>(null)
  const [newTableNumber, setNewTableNumber] = useState('')
  const [adding, setAdding] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchTables()
  }, [])

  useEffect(() => {
    if (showQR && qrCanvasRef.current) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const url = `${appUrl}/order/${showQR.id}`
      QRCode.toCanvas(qrCanvasRef.current, url, {
        width: 280,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
    }
  }, [showQR])

  const fetchTables = async () => {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .order('table_number', { ascending: true })
    setTables(data || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!newTableNumber.trim()) return
    setAdding(true)
    const { error } = await supabase.from('tables').insert({ table_number: newTableNumber.trim() })
    if (error) {
      toast.error('Tên bàn đã tồn tại!')
    } else {
      toast.success('Đã thêm bàn mới!')
      setNewTableNumber('')
      setShowAdd(false)
      fetchTables()
    }
    setAdding(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn chắc chắn muốn xóa bàn này?')) return
    const { error } = await supabase.from('tables').delete().eq('id', id)
    if (error) {
      toast.error('Không thể xóa bàn đang có đơn hàng!')
    } else {
      toast.success('Đã xóa bàn!')
      fetchTables()
    }
  }

  const downloadQR = () => {
    if (!qrCanvasRef.current || !showQR) return
    const link = document.createElement('a')
    link.download = `QR_${showQR.table_number}.png`
    link.href = qrCanvasRef.current.toDataURL()
    link.click()
  }

  const printQR = () => {
    if (!qrCanvasRef.current || !showQR) return
    const dataUrl = qrCanvasRef.current.toDataURL()
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>QR - ${showQR.table_number}</title></head>
          <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;margin:0;">
            <h2 style="margin-bottom:16px;">${showQR.table_number}</h2>
            <img src="${dataUrl}" style="width:280px;height:280px;" />
            <p style="margin-top:16px;color:#666;">Quét mã để gọi món</p>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Quản lý bàn</h1>
          <p className="text-slate-500 mt-1">Thêm bàn mới và tạo mã QR</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 w-fit">
          <Plus className="w-5 h-5" />
          Thêm bàn
        </button>
      </div>

      {/* Table Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables.map(table => (
          <div key={table.id} className="card p-5 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-slate-800">{table.table_number}</h3>
              <span className={table.status ? 'badge-active' : 'badge-inactive'}>
                {table.status ? 'Đang phục vụ' : 'Trống'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setShowQR(table)}
                className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                Mã QR
              </button>
              <button
                onClick={() => handleDelete(table.id)}
                disabled={table.status}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {tables.length === 0 && (
          <div className="col-span-full text-center py-16 card">
            <Grid3X3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-lg">Chưa có bàn nào</p>
            <p className="text-slate-400 text-sm">Bấm &quot;Thêm bàn&quot; để bắt đầu</p>
          </div>
        )}
      </div>

      {/* Modal: Add Table */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Thêm bàn mới</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Ví dụ: Bàn 01, VIP 02..."
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="input-field mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 btn-secondary">Hủy</button>
              <button onClick={handleAdd} disabled={adding || !newTableNumber.trim()} className="flex-1 btn-primary">
                {adding ? 'Đang thêm...' : 'Thêm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: QR Code */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowQR(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-slide-up text-center" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">{showQR.table_number}</h2>
              <button onClick={() => setShowQR(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-6 mb-4 flex items-center justify-center">
              <canvas ref={qrCanvasRef} />
            </div>
            <p className="text-sm text-slate-400 mb-4">Quét mã để gọi món tại {showQR.table_number}</p>
            <div className="flex gap-3">
              <button onClick={downloadQR} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Tải về
              </button>
              <button onClick={printQR} className="flex-1 btn-primary flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" />
                In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
