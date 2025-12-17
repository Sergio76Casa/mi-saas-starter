
export type Language = 'es' | 'ca';

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  is_superadmin: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
  tenant?: Tenant; 
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export interface Quote {
  id: string;
  tenant_id: string;
  customer_id: string;
  customer?: Customer;
  total_amount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_at: string;
  valid_until?: string;
  items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface PlatformContent {
  key: string; // e.g., 'home_hero_title'
  es: string;
  ca: string;
}

export interface TenantContent {
  tenant_id: string;
  key: string; // e.g., 'about_us_text'
  es: string;
  ca: string;
}
