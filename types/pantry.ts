export type ExpiryStatus = 'critical' | 'warning' | 'safe' | 'expired';

export type ItemUnit =
  | 'unidades'
  | 'kg'
  | 'g'
  | 'L'
  | 'ml'
  | 'paquetes'
  | 'cajas'
  | 'botellas'
  | 'latas'
  | 'docenas';

export type ItemCategory =
  | 'Lácteos'
  | 'Carnes'
  | 'Frutas y Verduras'
  | 'Despensa'
  | 'Bebidas'
  | 'Congelados'
  | 'Panadería'
  | 'Limpieza'
  | 'Farmacia'
  | 'Otros';

export const CATEGORIES: ItemCategory[] = [
  'Lácteos',
  'Carnes',
  'Frutas y Verduras',
  'Despensa',
  'Bebidas',
  'Congelados',
  'Panadería',
  'Limpieza',
  'Farmacia',
  'Otros',
];

export const UNITS: ItemUnit[] = [
  'unidades',
  'kg',
  'g',
  'L',
  'ml',
  'paquetes',
  'cajas',
  'botellas',
  'latas',
  'docenas',
];

export const CATEGORY_ICONS: Record<ItemCategory, string> = {
  'Lácteos': '🥛',
  'Carnes': '🥩',
  'Frutas y Verduras': '🍎',
  'Despensa': '🥫',
  'Bebidas': '🥤',
  'Congelados': '🧊',
  'Panadería': '🍞',
  'Limpieza': '🧹',
  'Farmacia': '💊',
  'Otros': '📦',
};

export interface PantryItem {
  id: string;
  pantry_id: string;
  added_by: string;
  name: string;
  category: ItemCategory;
  quantity: number | null;
  unit: ItemUnit | null;
  expiration_date: string | null; // ISO date string: "YYYY-MM-DD" or null if unknown
  image_url: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PantryItemWithStatus extends PantryItem {
  daysUntilExpiry: number;
  expiryStatus: ExpiryStatus;
}

export interface GroupedItems {
  category: ItemCategory;
  items: PantryItemWithStatus[];
}

export interface UserPreferences {
  user_id: string;
  display_name: string | null;
  active_pantry_id: string | null;
  notify_expiry_days: number;
  notify_email: boolean;
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface Pantry {
  id: string;
  name: string;
  share_code: string;
  created_by: string;
  created_at: string;
}

export interface PantryMember {
  pantry_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: string;
}

export interface NewPantryItem {
  name: string;
  category: ItemCategory;
  quantity: number | null;
  unit: ItemUnit | null;
  expiration_date: string | null;
  image_url: string | null;
  notes: string | null;
  pantry_id: string;
}
