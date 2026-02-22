// =============================================
// Database Types
// =============================================

export type OrderStatus = "serving" | "paid";

export interface Table {
  id: number;
  table_number: string;
  status: boolean;
  current_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  priority: number;
  created_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  table_id: number;
  customer_name: string | null;
  total_price: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: string;
  product_id: number;
  quantity: number;
  price_at_time: number;
  note: string | null;
  status: string;
  created_at: string;
}

// =============================================
// Extended Types (with relations)
// =============================================

export interface OrderWithItems extends Order {
  order_items: (OrderItem & { product: Product })[];
  table: Table;
}

export interface CategoryWithProducts extends Category {
  products: Product[];
}

// =============================================
// Settings Types
// =============================================

export interface AppSetting {
  id: number;
  key: string;
  value: string | null;
  label: string | null;
  description: string | null;
  updated_at: string;
}

// Typed map for easy access
export interface AppSettings {
  restaurant_name: string;
  qr_subtitle: string;
  wifi_name: string;
  wifi_password: string;
  qr_footer_note: string;
}

// =============================================
// Cart Types (Client-side)
// =============================================

export interface CartItem {
  product: Product;
  quantity: number;
  note: string;
}
