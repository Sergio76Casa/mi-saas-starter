
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
  status?: 'active' | 'inactive';
  logo_url?: string;
  use_logo_on_web?: boolean;
  phone?: string;
  email?: string;
  footer_description_es?: string;
  footer_description_ca?: string;
  social_instagram?: string;
  social_facebook?: string;
  social_tiktok?: string;
  social_youtube?: string;
  social_x?: string;
  social_linkedin?: string;
  social_whatsapp?: string;
  social_telegram?: string;
  partner_logo_1_url?: string;
  partner_logo_1_link?: string;
  partner_logo_iso9001_url?: string;
  partner_logo_iso9001_link?: string;
  partner_logo_2_url?: string;
  partner_logo_2_link?: string;
  // Campos para compartir
  share_title?: string;
  share_description?: string;
  share_image_url?: string;
  whatsapp_prefill_text?: string;
  is_deleted?: boolean;
  created_at: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  business_hours?: BusinessHours;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  open: string;    // "09:00"
  close: string;   // "18:00"
  closed: boolean; // true if closed all day
}

export interface Membership {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
  tenant?: Tenant;
  profiles?: Profile;
}

export interface Product {
  id: string;
  tenant_id: string;
  brand: string;
  model: string;
  type: string;
  status: 'draft' | 'active' | 'inactive';
  pricing: Array<{
    variant?: string;
    price: number;
    name?: { es: string; ca: string };
    cost?: number;
    id?: string;
  }>;
  description?: { es: string; ca: string };
  features?: string;
  installation_kits?: Array<{ name: string; price: number }>;
  extras?: Array<{ name: string; qty: number; unit_price: number }>;
  stock?: number;
  pdf_url?: string;
  image_url?: string;
  brand_logo_url?: string;
  is_deleted: boolean;
  created_at: string;
  price: number;
  techSpecs?: string;
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
  quote_no: string;
  customer?: Customer;
  tenant?: Tenant;
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
  maintenance_no?: string;
  is_technician?: boolean;
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
