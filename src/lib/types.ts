// =============================================
// Database Types
// =============================================

export type OrderStatus = "pending" | "completed" | "paid";

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
// Cart Types (Client-side)
// =============================================

export interface CartItem {
  product: Product;
  quantity: number;
  note: string;
}
