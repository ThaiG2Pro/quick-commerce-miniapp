export interface UserInfo {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  email: string;
  address: string;
}

export interface StorefrontProfile {
  shopName: string;
  shopAddress: string;
  logoUrl: string;
}

export interface LoyaltyProfile {
  points: number;
  expiryDate: string;
  barcodeValue: string;
}

export interface Product {
  id: number;
  medusaId?: string;
  variantId?: string;
  isPurchasable?: boolean;
  currencyCode?: string;
  isTaxInclusive?: boolean;
  priceMin?: number;
  priceMax?: number;
  type?: string;
  tags?: string[];
  hasPromotion?: boolean;
  hasCampaignPrice?: boolean;
  maxDiscountPercent?: number;
  variants?: ProductVariant[];
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: Category;
  detail?: string;
  sizes?: Size[];
  colors?: Color[];
}

export interface Category {
  id: number;
  medusaId?: string;
  handle: string;
  name: string;
  image: string;
}

export interface CartItem {
  lineItemId?: string;
  variantTitle?: string;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  product: Product;
  quantity: number;
}

export type Cart = CartItem[];

export interface CartPricing {
  currencyCode: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  isTaxInclusive: boolean;
  promotionCodes: string[];
  shippingMethodName?: string;
}

export interface ShippingOption {
  id: string;
  name: string;
  amount: number;
  currencyCode?: string;
  description?: string;
}

export interface PaymentProviderOption {
  id: string;
  name: string;
}

export interface Location {
  lat: number;
  lng: number;
}

export interface ShippingAddress {
  alias: string;
  address: string;
  address2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  countryCode?: string;
  name: string;
  phone: string;
}

export interface Station {
  id: number;
  name: string;
  image: string;
  address: string;
  location: Location;
  source?: "mock" | "medusa";
}

export type Delivery =
  | ({
      type: "shipping";
    } & ShippingAddress)
  | {
      type: "pickup";
      stationId: number;
    };

export type OrderStatus = "pending" | "shipping" | "completed";
export type PaymentStatus = "pending" | "success" | "failed";

export interface Order {
  id: number;
  medusaId?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  receivedAt: Date;
  items: CartItem[];
  delivery: Delivery;
  total: number;
  note: string;
}

// Medusa-specific types (from Medusa JS SDK)
export interface MedusaProduct {
  id: string;
  title: string;
  handle: string;
  description?: string;
  thumbnail?: string;
  images?: Array<{ url: string }>;
  categories?: MedusaCategory[];
  type?: { id: string; value: string };
  tags?: Array<{ id: string; value: string }>;
  options?: MedusaProductOption[];
  variants?: MedusaVariant[];
  metadata?: Record<string, any>;
}

export interface MedusaProductOption {
  id: string;
  title: string;
  values?: Array<{ id: string; value: string }>;
}

export interface MedusaCategory {
  id: string;
  name: string;
  handle: string;
  description?: string;
  parent_category_id?: string;
  product_category_image?: {
    url?: string;
  } | null;
  metadata?: Record<string, any>;
}

export interface MedusaVariant {
  id: string;
  title: string;
  product_id?: string;
  product?: {
    id: string;
    title?: string;
    thumbnail?: string;
  };
  sku?: string;
  calculated_price?: {
    is_calculated_price_price_list?: boolean;
    is_calculated_price_tax_inclusive?: boolean;
    calculated_amount?: number;
    original_amount?: number;
    currency_code?: string;
  };
  manage_inventory?: boolean;
  allow_backorder?: boolean;
  options?: Array<{
    id: string;
    value: string;
    option?: { id: string; title: string };
  }>;
  inventory_quantity?: number;
}

export interface ProductVariant {
  id: string;
  title: string;
  sku?: string;
  price: number;
  originalPrice?: number;
  currencyCode?: string;
  isTaxInclusive?: boolean;
  isPurchasable: boolean;
  isInStock: boolean;
  inventoryQuantity?: number;
  manageInventory?: boolean;
  allowBackorder?: boolean;
  isCampaignPrice?: boolean;
  optionValues: Array<{
    optionId: string;
    optionTitle: string;
    value: string;
  }>;
}

export interface MedusaLineItem {
  id: string;
  title?: string;
  subtitle?: string;
  quantity: number;
  unit_price?: number;
  subtotal?: number;
  tax_total?: number;
  total?: number;
  thumbnail?: string;
  variant_id?: string;
  product_id?: string;
  variant?: MedusaVariant;
}

export interface MedusaCart {
  id: string;
  currency_code?: string;
  subtotal?: number;
  discount_total?: number;
  shipping_total?: number;
  tax_total?: number;
  total?: number;
  item_tax_total?: number;
  region?: {
    id?: string;
    currency_code?: string;
    countries?: Array<{ iso_2: string }>;
  };
  promotions?: Array<{
    id: string;
    code?: string;
  }>;
  shipping_methods?: Array<{
    id: string;
    amount?: number;
    shipping_option?: {
      id: string;
      name?: string;
    };
  }>;
  items?: MedusaLineItem[];
}

export interface Size {
  id: string;
  label: string;
}

export interface Color {
  id: string;
  label: string;
  hex: string;
}
