'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppSetting } from '@/lib/types'
import toast from 'react-hot-toast'
import { Save, Settings2, Wifi, Store, MessageSquare, FileText, Info } from 'lucide-react'

const SETTING_ICONS: Record<string, React.ElementType> = {
  restaurant_name: Store,
  qr_subtitle: MessageSquare,
  wifi_name: Wifi,
  wifi_password: Wifi,
  qr_footer_note: FileText,
}

export default function SettingsPage() {
  const supabaseRef = useRef(createClient())
  const [rows, setRows] = useState<AppSetting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const { data, error } = await supabaseRef.current
      .from('settings')
      .select('*')
      .order('id')
    if (error) {
      toast.error('Không thể tải cấu hình!')
    } else {
      setRows(data as AppSetting[])
      const map: Record<string, string> = {}
      ;(data as AppSetting[]).forEach(r => { map[r.key] = r.value ?? '' })
      setValues(map)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const updates = rows.map(r =>
      supabaseRef.current
        .from('settings')
        .update({ value: values[r.key] ?? '', updated_at: new Date().toISOString() })
        .eq('key', r.key)
    )
    const results = await Promise.all(updates)
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      toast.error('Có lỗi khi lưu, vui lòng thử lại!')
    } else {
      toast.success('Đã lưu cấu hình thành công!')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Cấu hình chung</h1>
          <p className="text-slate-500 mt-1">Nội dung hiển thị trên tờ in QR của tất cả bàn</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 w-fit"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Những thông tin này sẽ tự động áp dụng cho <strong>tất cả bàn</strong> khi in mã QR.
          Để trống các trường không cần hiển thị.
        </p>
      </div>

      {/* Settings Form */}
      <div className="space-y-4">
        {rows.map(row => {
          const Icon = SETTING_ICONS[row.key] ?? Settings2
          const isPassword = row.key === 'wifi_password'
          return (
            <div key={row.key} className="card p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block font-semibold text-slate-800 text-sm mb-0.5">
                    {row.label}
                  </label>
                  {row.description && (
                    <p className="text-xs text-slate-400 mb-2">{row.description}</p>
                  )}
                  <input
                    type={isPassword ? 'text' : 'text'}
                    value={values[row.key] ?? ''}
                    onChange={e => setValues(prev => ({ ...prev, [row.key]: e.target.value }))}
                    placeholder={`Nhập ${row.label?.toLowerCase()}...`}
                    className="input-field text-sm"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* QR Preview Card */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-orange-500" />
          Xem trước tờ QR
        </h2>
        <div className="card p-6 flex flex-col items-center gap-3 bg-slate-50 border-dashed">
          <span className="text-xs font-semibold text-orange-500 uppercase tracking-widest">
            🍽 {values['restaurant_name'] || 'Tên nhà hàng'}
          </span>
          <p className="text-2xl font-extrabold text-slate-900">Bàn 01</p>
          <div className="w-10 h-0.5 bg-orange-400 rounded-full" />
          {/* QR placeholder */}
          <div className="w-40 h-40 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center">
            <span className="text-slate-300 text-xs text-center px-2">Mã QR<br />của bàn</span>
          </div>
          {values['qr_subtitle'] && (
            <p className="text-sm text-slate-500">{values['qr_subtitle']}</p>
          )}
          {(values['wifi_name'] || values['wifi_password']) && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600">
              <Wifi className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span>
                {values['wifi_name'] && <><strong>WiFi:</strong> {values['wifi_name']}</>}
                {values['wifi_name'] && values['wifi_password'] && ' | '}
                {values['wifi_password'] && <><strong>Mật khẩu:</strong> {values['wifi_password']}</>}
              </span>
            </div>
          )}
          {values['qr_footer_note'] && (
            <p className="text-xs text-slate-400 text-center">{values['qr_footer_note']}</p>
          )}
        </div>
      </div>

      {/* Save button bottom */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>
    </div>
  )
}
