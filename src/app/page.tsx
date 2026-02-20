import Link from 'next/link'
import { UtensilsCrossed, ShieldCheck } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="text-center animate-slide-up">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-500 rounded-3xl shadow-xl shadow-orange-500/30 mb-8">
          <UtensilsCrossed className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
          Hệ Thống Gọi Món
        </h1>
        <p className="text-lg text-slate-500 mb-10 max-w-md mx-auto">
          Quét mã QR tại bàn để xem menu và đặt món nhanh chóng
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 btn-primary text-lg px-8 py-3"
          >
            <ShieldCheck className="w-5 h-5" />
            Quản trị viên
          </Link>
        </div>

        <p className="mt-8 text-sm text-slate-400">
          Khách hàng vui lòng quét mã QR tại bàn để bắt đầu gọi món
        </p>
      </div>
    </main>
  )
}
