

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

export interface Product {
  id: string;
  tenant_id: string;
  brand: string;
  model: string;
  type: string;
  status: 'draft' | 'active' | 'inactive';
  pricing: Array<{ variant: string; price: number }>; 
  features?: string;
  installation_kits?: Array<{ name: string; price: number }>;
  extras?: Array<{ name: string; price: number }>;
  stock?: number;
  pdf_url?: string;
  image_url?: string;
  brand_logo_url?: string;
  is_deleted: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  created_by?: string;
  referred_by?: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dni?: string;
  population?: string;
  created_at: string;
}

export interface Quote {
  id: string;
  tenant_id: string;
  customer_id: string;
  created_by: string;
  quote_no: string; 
  customer?: Customer;
  client_name: string;
  client_dni: string;
  client_address: string;
  client_population: string;
  client_email: string;
  client_phone: string;
  total_amount: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  valid_until: string;
  financing_months?: number;
  financing_fee?: number;
  items?: QuoteItem[];
  // Added maintenance_no to support maintenance or repair identification in quotes
  maintenance_no?: string;
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
  key: string; 
  es: string;
  ca: string;
}