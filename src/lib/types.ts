export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  available: number;
  created_at: string;
};

export type Waiter = {
  id: number;
  name: string;
  active: number;
  created_at: string;
};

export type TableArea = "outside" | "inside";

export type Table = {
  id: number;
  number: number;
  seats: number;
  area: TableArea;
  status: "free" | "occupied" | "reserved";
  created_at: string;
};

export type OrderStatus = "open" | "preparing" | "ready" | "closed" | "cancelled";

export type Order = {
  id: number;
  table_id: number;
  waiter_id: number;
  status: OrderStatus;
  notes: string;
  total: number;
  created_at: string;
  closed_at: string | null;
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
};

export type OrderWithDetails = Order & {
  table_number: number;
  table_area: TableArea;
  waiter_name: string;
  items: (OrderItem & { product_name: string })[];
  /** Soma dos itens, sem taxa de serviço */
  subtotal: number;
  /** Taxa de serviço (10% do subtotal) */
  service_fee: number;
};

export type DashboardStats = {
  openOrders: number;
  freeTables: number;
  occupiedTables: number;
  todayRevenue: number;
  todayOrders: number;
  activeWaiters: number;
  productsCount: number;
};
