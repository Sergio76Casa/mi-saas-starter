export type Language = 'es' | 'ca' | 'en' | 'fr';

export interface LocalizedText {
  es: string;
  en: string;
  ca: string;
  fr: string;
}

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
  branding?: {
    logo_url?: string;
    primary_color?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export interface Membership {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
  tenant?: Tenant; 
}

export interface TechnicalSpecs {
  coolingCapacityKw: number | null;
  heatingCapacityKw: number | null;
  seer: number | null;
  scop: number | null;
  refrigerant: string;
  powerSupply: string;
  soundPressureDb: number | null;
  dimensionsMm: string;
  weightKg: number | null;
  operatingRange: string;
  connectivity: string;
  warranty: string;
}

export interface PricingItem {
  id: string;
  name: LocalizedText;
  price: number | null;
  cost: number | null;
}

export interface InstallationKit {
  id: string;
  name: LocalizedText;
  items: string[];
  price: number | null;
  cost: number | null;
}

export interface Extra {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  unitPrice: number | null;
  unitCost: number | null;
}

export interface FinancingOption {
  id: string;
  name: LocalizedText;
  months: number | null;
  coefficient: number | null;
  commission: number | null;
}

export interface Product {
  id: string;
  tenant_id: string;
  brand: string;
  model: string;
  type: string;
  category: string;
  description: LocalizedText;
  image_url?: string;
  stock: number;
  technical_specs: TechnicalSpecs;
  pricing_items: PricingItem[];
  installation_kits: InstallationKit[];
  extras: Extra[];
  financing_options: FinancingOption[];
  is_active: boolean;
  is_deleted?: boolean;
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
  customer_id?: string;
  created_by?: string;
  quote_no: string; 
  
  // Client Data
  client_name: string;
  client_dni: string;
  client_address: string;
  client_population: string;
  client_email: string;
  client_phone: string;
  work_order_no?: string;
  
  total_amount: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  valid_until: string;
  
  // Signature
  signature_base64?: string;
  signed_at?: string;
  
  // Selection
  selected_product_id: string;
  selected_kit_id?: string;
  selected_extras: { id: string; quantity: number }[];
  selected_financing_id?: string;
  
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
  key: string; 
  es: string;
  ca: string;
  en: string;
  fr: string;
}