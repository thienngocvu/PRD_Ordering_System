"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Grid3X3,
  FolderKanban,
  LogOut,
  Menu,
  X,
  Bell,
  ChefHat,
  User,
  Settings2,
} from "lucide-react";

interface Notification {
  id: string;
  message: string;
  type: "order" | "staff-call";
  time: Date;
  read: boolean;
}

const navItems = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/tables", label: "Quản lý bàn", icon: Grid3X3 },
  { href: "/admin/categories", label: "Danh mục", icon: FolderKanban },
  { href: "/admin/products", label: "Món ăn", icon: UtensilsCrossed },
  { href: "/admin/orders", label: "Đơn hàng", icon: ClipboardList },
  { href: "/admin/settings", label: "Cấu hình", icon: Settings2 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);

  const addNotification = useCallback(
    (message: string, type: "order" | "staff-call") => {
      const notification: Notification = {
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        message,
        type,
        time: new Date(),
        read: false,
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
    },
    [],
  );

  useEffect(() => {
    const supabase = supabaseRef.current;

    const ordersChannel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new as {
            customer_name?: string;
            table_id?: number;
            created_by?: string;
          };
          if (newOrder.created_by === "admin") return;
          setNewOrderCount((prev) => prev + 1);
          const message = `Đơn hàng mới${newOrder.customer_name ? ` từ ${newOrder.customer_name}` : ""}!`;
          addNotification(message, "order");
          toast(`🔔 ${message}`, {
            duration: 5000,
            style: {
              background: "#f97316",
              color: "#fff",
              fontWeight: 600,
            },
          });
          try {
            const audio = new Audio("/notification.wav");
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch {}
        },
      )
      .subscribe();

    const staffChannel = supabase
      .channel("staff-call")
      .on("broadcast", { event: "call-staff" }, (payload) => {
        const data = payload.payload as {
          tableName?: string;
          customerName?: string;
        };
        const message = `${data.tableName || "Có bàn"} đang gọi nhân viên!${data.customerName ? ` (${data.customerName})` : ""}`;
        addNotification(message, "staff-call");
        toast(`🔔 ${message}`, {
          duration: 8000,
          style: {
            background: "#3b82f6",
            color: "#fff",
            fontWeight: 600,
          },
          icon: "🙋",
        });
        try {
          const audio = new Audio("/notification.wav");
          audio.volume = 0.7;
          audio.play().catch(() => {});
        } catch {}
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(staffChannel);
    };
  }, [addNotification]);

  // Close notification panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationPanelRef.current &&
        !notificationPanelRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const handleBellClick = () => {
    setShowNotifications((prev) => !prev);
  };

  const handleNotificationClick = (notification: Notification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );
    if (notification.type === "order") {
      router.push("/admin/orders");
    }
    setShowNotifications(false);
    setNewOrderCount(0);
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setNewOrderCount(0);
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setNewOrderCount(0);
    setShowNotifications(false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Vừa xong";
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} giờ trước`;
    return `${Math.floor(diffHr / 24)} ngày trước`;
  };

  const handleLogout = async () => {
    await supabaseRef.current.auth.signOut();
    toast.success("Đã đăng xuất!");
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  // Notification Panel Component
  const NotificationPanel = () => (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-[60]">
      {/* Panel Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Thông báo</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
                className="text-xs text-white/80 hover:text-white transition-colors underline underline-offset-2"
              >
                Đánh dấu đã đọc
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearAllNotifications();
                }}
                className="text-xs text-white/80 hover:text-white transition-colors"
                title="Xóa tất cả"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Chưa có thông báo nào</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={(e) => {
                e.stopPropagation();
                handleNotificationClick(notification);
              }}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 ${
                !notification.read ? "bg-orange-50/50" : ""
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  notification.type === "order"
                    ? "bg-orange-100 text-orange-600"
                    : "bg-blue-100 text-blue-600"
                }`}
              >
                {notification.type === "order" ? (
                  <ChefHat className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${!notification.read ? "font-semibold text-slate-900" : "text-slate-600"}`}
                >
                  {notification.message}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatTimeAgo(notification.time)}
                </p>
              </div>
              {!notification.read && (
                <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-2" />
              )}
            </button>
          ))
        )}
      </div>

      {/* Panel Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
          <Link
            href="/admin/orders"
            onClick={() => {
              setShowNotifications(false);
              setNewOrderCount(0);
            }}
            className="text-sm text-orange-600 hover:text-orange-700 font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Xem tất cả đơn hàng
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <Menu className="w-6 h-6 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <UtensilsCrossed className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-800">Quản trị</span>
        </div>
        {/* Mobile Bell */}
        <div className="relative" ref={notificationPanelRef}>
          <button
            onClick={handleBellClick}
            className="relative p-2 hover:bg-slate-100 rounded-xl transition-colors"
            title="Xem thông báo"
          >
            <Bell
              className={`w-6 h-6 transition-colors ${unreadCount > 0 ? "text-orange-500" : "text-slate-600"}`}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && <NotificationPanel />}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl animate-slide-up p-6 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg text-slate-800">
                  Quản trị
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <nav className="space-y-1 flex-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={
                    isActive(item.href) ? "sidebar-link-active" : "sidebar-link"
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                  {item.href === "/admin/orders" && unreadCount > 0 && (
                    <span className="ml-auto w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              className="sidebar-link text-red-500 hover:bg-red-50 hover:text-red-600 mt-4"
            >
              <LogOut className="w-5 h-5" />
              Đăng xuất
            </button>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 flex-col p-6 z-40">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800">Hệ thống gọi món</p>
            <p className="text-xs text-slate-400">Quản trị viên</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive(item.href) ? "sidebar-link-active" : "sidebar-link"
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.href === "/admin/orders" && unreadCount > 0 && (
                <span className="ml-auto w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="sidebar-link text-red-500 hover:bg-red-50 hover:text-red-600 mt-2"
        >
          <LogOut className="w-5 h-5" />
          Đăng xuất
        </button>
      </aside>

      {/* Desktop Header */}
      <header className="hidden lg:flex fixed top-0 left-64 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-3 items-center justify-end">
        {/* Bell notification - always in header */}
        <div className="relative" ref={notificationPanelRef}>
          <button
            onClick={handleBellClick}
            className="relative p-2.5 hover:bg-slate-100 rounded-xl transition-colors group"
            title="Xem thông báo"
          >
            <Bell
              className={`w-5 h-5 transition-colors ${unreadCount > 0 ? "text-orange-500" : "text-slate-500 group-hover:text-slate-700"}`}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && <NotificationPanel />}
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
