import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // ⚡ CRITICAL: Vercel Free chỉ có 1,000 image optimizations/tháng
    // Dùng unoptimized = true để bypass Vercel Image Optimization API
    // Ảnh vẫn hiển thị bình thường, chỉ không qua Vercel proxy resize
    // Ảnh từ Supabase Storage đã serve qua CDN sẵn rồi
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Tối ưu output cho Vercel Free
  poweredByHeader: false,
  // Compress responses
  compress: true,
};

export default nextConfig;
