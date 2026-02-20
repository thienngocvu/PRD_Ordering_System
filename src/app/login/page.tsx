'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UtensilsCrossed, LogIn, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  // ⚡ Tạo supabase client 1 lần duy nhất
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error('Đăng nhập thất bại! Kiểm tra lại thông tin.')
      setLoading(false)
      return
    }

    toast.success('Đăng nhập thành công!')
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl shadow-xl shadow-orange-500/30 mb-4">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Đăng nhập quản trị</h1>
          <p className="text-slate-400 mt-1">Nhập thông tin để truy cập hệ thống</p>
        </div>

        {/* Form */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ordering.local"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Đăng nhập
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Hệ Thống Gọi Món QR &copy; {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
