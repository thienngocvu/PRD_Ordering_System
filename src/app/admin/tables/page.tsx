'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Table, AppSettings } from '@/lib/types'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { Plus, Trash2, QrCode, X, Download, Printer, Grid3X3 } from 'lucide-react'

const DEFAULT_SETTINGS: AppSettings = {
  restaurant_name: 'Hệ thống gọi món',
  qr_subtitle: 'Quét mã QR để gọi món nhanh chóng',
  wifi_name: '',
  wifi_password: '',
  qr_footer_note: '',
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showQR, setShowQR] = useState<Table | null>(null)
  const [newTableNumber, setNewTableNumber] = useState('')
  const [adding, setAdding] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  // ⚡ Tạo supabase client 1 lần duy nhất
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    fetchTables()
    fetchSettings()
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
    // ⚡ Chỉ SELECT cột cần thiết
    const { data } = await supabase
      .from('tables')
      .select('id, table_number, status')
      .order('table_number', { ascending: true })
    setTables((data || []) as Table[])
    setLoading(false)
  }

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('key, value')
    if (data) {
      const map = Object.fromEntries(data.map(r => [r.key, r.value ?? '']))
      setSettings(prev => ({ ...prev, ...map }))
    }
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

  const downloadQR = async () => {
    if (!qrCanvasRef.current || !showQR) return

    const { restaurant_name, qr_subtitle, wifi_name, wifi_password, qr_footer_note } = settings

    // ─── Layout constants ───────────────────────────────────────────
    const W = 420          // card width
    const QR_SIZE = 280    // QR image size
    const PADDING = 32     // horizontal padding
    const INNER = W - PADDING * 2
    const RADIUS = 20      // card corner radius

    // Helper: measure multiline text and return lines
    const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
      const words = text.split(' ')
      const lines: string[] = []
      let line = ''
      for (const word of words) {
        const test = line ? `${line} ${word}` : word
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line)
          line = word
        } else {
          line = test
        }
      }
      if (line) lines.push(line)
      return lines
    }

    // ─── First pass: calculate total height ─────────────────────────
    const offCtx = document.createElement('canvas').getContext('2d')!
    let estimatedH = PADDING          // top padding
    estimatedH += 18                  // restaurant_name row
    estimatedH += 12                  // gap
    estimatedH += 40                  // table name
    estimatedH += 20                  // gap + divider
    estimatedH += 24                  // gap after divider
    estimatedH += QR_SIZE + 24        // QR
    if (qr_subtitle) estimatedH += 28
    if (wifi_name || wifi_password) estimatedH += 52
    if (qr_footer_note) {
      offCtx.font = '13px sans-serif'
      estimatedH += wrapText(offCtx, qr_footer_note, INNER).length * 18 + 16
    }
    estimatedH += PADDING             // bottom padding

    // ─── Create canvas ───────────────────────────────────────────────
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = estimatedH
    const ctx = canvas.getContext('2d')!

    // Background
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(0, 0, W, estimatedH, RADIUS)
    ctx.fill()

    // Border
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(1, 1, W - 2, estimatedH - 2, RADIUS)
    ctx.stroke()

    let y = PADDING

    // ── Restaurant name (orange, small caps) ─────────────────────────
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif'
    ctx.fillStyle = '#f97316'
    ctx.textAlign = 'center'
    ctx.fillText(`🍽 ${restaurant_name.toUpperCase()}`, W / 2, y + 13)
    y += 30

    // ── Table name (large, bold) ──────────────────────────────────────
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif'
    ctx.fillStyle = '#0f172a'
    ctx.fillText(showQR.table_number, W / 2, y + 36)
    y += 52

    // ── Orange divider ────────────────────────────────────────────────
    ctx.fillStyle = '#f97316'
    ctx.beginPath()
    ctx.roundRect(W / 2 - 24, y, 48, 3, 2)
    ctx.fill()
    y += 20

    // ── QR Code image ─────────────────────────────────────────────────
    const qrX = (W - QR_SIZE) / 2
    // Draw subtle white card behind QR
    ctx.fillStyle = '#f8fafc'
    ctx.beginPath()
    ctx.roundRect(qrX - 12, y, QR_SIZE + 24, QR_SIZE + 24, 12)
    ctx.fill()
    ctx.drawImage(qrCanvasRef.current, qrX, y + 12, QR_SIZE, QR_SIZE)
    y += QR_SIZE + 36

    // ── Subtitle ──────────────────────────────────────────────────────
    if (qr_subtitle) {
      ctx.font = '14px "Segoe UI", Arial, sans-serif'
      ctx.fillStyle = '#64748b'
      ctx.fillText(`📱 ${qr_subtitle}`, W / 2, y)
      y += 28
    }

    // ── WiFi box ──────────────────────────────────────────────────────
    if (wifi_name || wifi_password) {
      const boxH = 44
      ctx.fillStyle = '#f0f9ff'
      ctx.strokeStyle = '#bae6fd'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(PADDING, y, INNER, boxH, 10)
      ctx.fill()
      ctx.stroke()

      ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif'
      ctx.fillStyle = '#0369a1'
      ctx.textAlign = 'center'
      const wifiLine = [
        wifi_name ? `WiFi: ${wifi_name}` : '',
        wifi_password ? `Mật khẩu: ${wifi_password}` : '',
      ].filter(Boolean).join('   |   ')
      ctx.fillText(`📶  ${wifiLine}`, W / 2, y + boxH / 2 + 5)
      y += boxH + 14
    }

    // ── Footer note ───────────────────────────────────────────────────
    if (qr_footer_note) {
      ctx.font = 'italic 13px "Segoe UI", Arial, sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.textAlign = 'center'
      const lines = wrapText(ctx, qr_footer_note, INNER)
      for (const line of lines) {
        ctx.fillText(line, W / 2, y)
        y += 18
      }
    }

    // ─── Export ──────────────────────────────────────────────────────
    const link = document.createElement('a')
    link.download = `QR_Card_${showQR.table_number}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const printQR = () => {
    if (!qrCanvasRef.current || !showQR) return
    const dataUrl = qrCanvasRef.current.toDataURL()
    const { restaurant_name, qr_subtitle, wifi_name, wifi_password, qr_footer_note } = settings

    // Build optional blocks
    const wifiBlock = (wifi_name || wifi_password)
      ? `<div class="wifi-box">
           <span class="wifi-icon">📶</span>
           <div class="wifi-info">
             ${wifi_name ? `<span><strong>WiFi:</strong> ${wifi_name}</span>` : ''}
             ${wifi_password ? `<span><strong>Mật khẩu:</strong> ${wifi_password}</span>` : ''}
           </div>
         </div>`
      : ''
    const footerBlock = qr_footer_note
      ? `<p class="footer-note">${qr_footer_note}</p>`
      : ''

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR - ${showQR.table_number}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                font-family: 'Segoe UI', Arial, sans-serif;
                background: #fff;
              }
              .card {
                display: flex;
                flex-direction: column;
                align-items: center;
                border: 2px solid #e2e8f0;
                border-radius: 20px;
                padding: 32px 40px;
                gap: 14px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                max-width: 360px;
              }
              .logo {
                font-size: 13px;
                font-weight: 600;
                color: #f97316;
                letter-spacing: 1px;
                text-transform: uppercase;
              }
              .table-name {
                font-size: 32px;
                font-weight: 800;
                color: #0f172a;
                letter-spacing: -0.5px;
                text-align: center;
              }
              .divider {
                width: 48px;
                height: 3px;
                background: #f97316;
                border-radius: 99px;
              }
              .qr-wrap {
                background: #f8fafc;
                border-radius: 12px;
                padding: 12px;
              }
              .qr-wrap img {
                display: block;
                width: 260px;
                height: 260px;
              }
              .subtitle {
                font-size: 14px;
                color: #64748b;
                font-weight: 500;
                text-align: center;
              }
              .wifi-box {
                display: flex;
                align-items: center;
                gap: 8px;
                background: #f0f9ff;
                border: 1px solid #bae6fd;
                border-radius: 10px;
                padding: 8px 14px;
                width: 100%;
              }
              .wifi-icon { font-size: 16px; }
              .wifi-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
                font-size: 12px;
                color: #0369a1;
              }
              .footer-note {
                font-size: 11px;
                color: #94a3b8;
                text-align: center;
                font-style: italic;
              }
              @media print {
                body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="card">
              <span class="logo">🍽 ${restaurant_name}</span>
              <p class="table-name">${showQR.table_number}</p>
              <div class="divider"></div>
              <div class="qr-wrap">
                <img src="${dataUrl}" />
              </div>
              ${qr_subtitle ? `<p class="subtitle">📱 ${qr_subtitle}</p>` : ''}
              ${wifiBlock}
              ${footerBlock}
            </div>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Mã QR — {showQR.table_number}</h2>
              <button onClick={() => setShowQR(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* QR Card Preview — giống tờ in thật */}
            <div className="mx-5 mb-4 border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-3 bg-slate-50">
              {/* Restaurant name */}
              <span className="text-[11px] font-semibold text-orange-500 uppercase tracking-widest">
                🍽 {settings.restaurant_name}
              </span>

              {/* Table name */}
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {showQR.table_number}
              </p>

              {/* Orange divider */}
              <div className="w-10 h-0.5 bg-orange-400 rounded-full" />

              {/* QR Canvas */}
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                <canvas ref={qrCanvasRef} />
              </div>

              {/* Subtitle */}
              {settings.qr_subtitle && (
                <p className="text-xs text-slate-500 font-medium">
                  📱 {settings.qr_subtitle}
                </p>
              )}

              {/* Wifi info */}
              {(settings.wifi_name || settings.wifi_password) && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 w-full justify-center">
                  <span>📶</span>
                  <span className="flex flex-wrap gap-x-2 justify-center">
                    {settings.wifi_name && <span><strong>WiFi:</strong> {settings.wifi_name}</span>}
                    {settings.wifi_password && <span><strong>Mật khẩu:</strong> {settings.wifi_password}</span>}
                  </span>
                </div>
              )}

              {/* Footer note */}
              {settings.qr_footer_note && (
                <p className="text-[11px] text-slate-400 italic text-center">
                  {settings.qr_footer_note}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 pb-5">
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
