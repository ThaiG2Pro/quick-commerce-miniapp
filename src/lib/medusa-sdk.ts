import Medusa from "@medusajs/js-sdk";
import {
  LoyaltyProfile,
  MedusaCart,
  ShippingAddress,
  Station,
  StorefrontProfile,
  UserInfo,
} from "@/types";
import CONFIG from "@/config";

// Cấu hình Medusa SDK
const MEDUSA_BACKEND_URL = import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY || "";

if (!MEDUSA_PUBLISHABLE_KEY && typeof window !== "undefined") {
  console.warn(
    "VITE_MEDUSA_PUBLISHABLE_KEY is empty. Store APIs may fail with 400 missing x-publishable-api-key."
  );
}

// Khởi tạo Medusa SDK client
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: import.meta.env.DEV,
  publishableKey: MEDUSA_PUBLISHABLE_KEY,
  auth: {
    type: "jwt",
  },
});

// Default avatar used when no avatar is available from Medusa or metadata
export const DEFAULT_AVATAR_URL =
  "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

// Ensure publishable key header is always sent with store requests.
// Some Medusa deployments require `x-publishable-api-key` on store endpoints.
// Wrap sdk.client.fetch to inject the header if the SDK didn't do it.
try {
  const PUBLISHABLE = MEDUSA_PUBLISHABLE_KEY;
  if (PUBLISHABLE) {
    // If SDK exposes a setHeader method, prefer it.
    if ((sdk.client as any)?.setHeader && typeof (sdk.client as any).setHeader === "function") {
      try {
        (sdk.client as any).setHeader("x-publishable-api-key", PUBLISHABLE);
      } catch (e) {
        console.warn("Could not set publishable key via sdk.client.setHeader:", e);
      }
    }

    // Wrap fetch to ensure header is present on every request as a fallback.
    if ((sdk.client as any)?.fetch && typeof (sdk.client as any).fetch === "function") {
      const originalFetch = (sdk.client as any).fetch.bind((sdk.client as any));
      (sdk.client as any).fetch = async (path: string, options?: any) => {
        options = options || {};
        options.headers = {
          ...(options.headers || {}),
          "x-publishable-api-key": PUBLISHABLE,
        };
        return originalFetch(path, options);
      };
    }
  }
} catch (e) {
  console.warn("Failed to attach publishable key header to Medusa SDK client:", e);
}

let cachedDefaultRegionId: string | null | undefined;
// Ensure we request calculated prices and inventory-related fields for variants
const CALCULATED_PRICE_FIELD = "*variants.calculated_price,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder";
const ORDER_QUERY_FIELDS = [
  "id",
  "total",
  "subtotal",
  "tax_total",
  "original_total",
  "shipping_total",
  "created_at",
  "payment_status",
  "fulfillment_status",
  "currency_code",
  "customer_note",
  "metadata",
  "display_id",
  "items.thumbnail",
  "items.title",
  "items.quantity",
  "items.unit_price",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.city",
].join(",");

async function getDefaultRegionId() {
  if (cachedDefaultRegionId !== undefined) {
    return cachedDefaultRegionId;
  }

  const response = await sdk.store.region.list();
  cachedDefaultRegionId = response.regions?.[0]?.id || null;
  return cachedDefaultRegionId;
}

function ensureCalculatedPriceField(fields?: string) {
  if (!fields) {
    return CALCULATED_PRICE_FIELD;
  }

  const normalized = fields
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  if (normalized.includes(CALCULATED_PRICE_FIELD)) {
    return fields;
  }

  return `${CALCULATED_PRICE_FIELD},${fields}`;
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const candidate = error as {
    status?: number;
    response?: { status?: number };
  };

  return candidate.status || candidate.response?.status;
}

function isAuthError(error: unknown) {
  const status = getErrorStatusCode(error);
  return status === 401 || status === 403;
}

type MedusaCustomerAddress = {
  id?: string;
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country_code?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
};

function splitFullName(name: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" ") || "",
  };
}

function toShippingAddressPayload(address: ShippingAddress) {
  const name = address.name.trim() || "Khách hàng";
  const { first_name, last_name } = splitFullName(name);

  return {
    first_name,
    last_name,
    address_1: address.address.trim(),
    address_2: address.address2?.trim() || undefined,
    city: address.city.trim(),
    province: address.province?.trim() || undefined,
    postal_code: address.postalCode?.trim() || undefined,
    country_code: address.countryCode?.trim().toLowerCase() || "vn",
    phone: address.phone.trim() || undefined,
  };
}

function transformMedusaCustomerAddressRecord(
  address: unknown
): (MedusaCustomerAddress & { id: string }) | null {
  if (!address || typeof address !== "object") {
    return null;
  }

  const record = address as MedusaCustomerAddress;
  if (!record.id) {
    return null;
  }

  return {
    ...record,
    id: record.id,
  };
}

export function transformMedusaCustomerAddressToShippingAddress(
  address: unknown
): ShippingAddress | null {
  const record = transformMedusaCustomerAddressRecord(address);
  if (!record) {
    return null;
  }

  const firstName = typeof record.first_name === "string" ? record.first_name.trim() : "";
  const lastName = typeof record.last_name === "string" ? record.last_name.trim() : "";
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const metadata = record.metadata || {};
  const alias =
    toNonEmptyString(metadata.alias) ||
    toNonEmptyString(metadata.name) ||
    toNonEmptyString(metadata.label) ||
    name ||
    toNonEmptyString(record.address_1) ||
    "Địa chỉ mặc định";

  const addressLine = toNonEmptyString(record.address_1) || "";
  const city = toNonEmptyString(record.city) || "";
  const phone = toNonEmptyString(record.phone) || "";

  if (!addressLine || !city) {
    return null;
  }

  return {
    alias,
    address: addressLine,
    address2: toNonEmptyString(record.address_2),
    city,
    province: toNonEmptyString(record.province),
    postalCode: toNonEmptyString(record.postal_code),
    countryCode: toNonEmptyString(record.country_code)?.toLowerCase() || "vn",
    name: name || alias,
    phone,
  };
}

// Helper functions để làm việc với Medusa

/**
 * Lấy danh sách sản phẩm
 */
export async function getProducts(params?: {
  limit?: number;
  offset?: number;
  region_id?: string;
  country_code?: string;
  province?: string;
  cart_id?: string;
  fields?: string;
  category_id?: string | string[];
  collection_id?: string[];
  q?: string; // search query
}) {
  try {
    const regionId = params?.region_id || (await getDefaultRegionId());
    const response = await sdk.store.product.list({
      ...params,
      fields: ensureCalculatedPriceField(params?.fields),
      ...(regionId ? { region_id: regionId } : {}),
    });
    return response.products;
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
}

/**
 * Lấy chi tiết sản phẩm
 */
export async function getProduct(
  id: string,
  params?: {
    region_id?: string;
    country_code?: string;
    province?: string;
    cart_id?: string;
    fields?: string;
  }
) {
  try {
    const regionId = params?.region_id || (await getDefaultRegionId());
    const response = await sdk.store.product.retrieve(id, {
      ...params,
      fields: ensureCalculatedPriceField(params?.fields),
      ...(regionId ? { region_id: regionId } : {}),
    });
    return response.product;
  } catch (error) {
    console.error("Error fetching product:", error);
    throw error;
  }
}

/**
 * Lấy danh sách categories
 */
export async function getCategories(params?: {
  limit?: number;
  offset?: number;
  parent_category_id?: string;
  fields?: string;
}) {
  try {
    // Medusa v2 uses 'category' not 'productCategory'
    const response = await sdk.store.category.list(params);
    return response.product_categories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }
}

/**
 * Tạo giỏ hàng mới hoặc lấy giỏ hàng hiện tại
 */
export async function createCart(regionId?: string) {
  try {
    if (typeof window !== "undefined") {
      console.debug("medusa-sdk: createCart called", { regionId });
    }
    const response = await sdk.store.cart.create(
      regionId ? { region_id: regionId } : {}
    );
    if (typeof window !== "undefined") {
      console.debug("medusa-sdk: createCart response", { cartId: response.cart?.id });
    }
    return response.cart;
  } catch (error) {
    console.error("Error creating cart:", error);
    throw error;
  }
}

/**
 * Lấy thông tin giỏ hàng
 */
export async function getCart(cartId: string) {
  try {
    const response = await sdk.store.cart.retrieve(cartId);
    return response.cart;
  } catch (error) {
    console.error("Error fetching cart:", error);
    throw error;
  }
}

/**
 * Thêm sản phẩm vào giỏ hàng
 */
export async function addToCart(cartId: string, variantId: string, quantity: number) {
  try {
    const response = await sdk.store.cart.createLineItem(cartId, {
      variant_id: variantId,
      quantity,
    });
    return response.cart;
  } catch (error) {
    console.error("Error adding to cart:", error);
    throw error;
  }
}

/**
 * Cập nhật số lượng sản phẩm trong giỏ hàng
 */
export async function updateLineItem(
  cartId: string,
  lineItemId: string,
  quantity: number
) {
  try {
    const response = await sdk.store.cart.updateLineItem(cartId, lineItemId, {
      quantity,
    });
    return response.cart;
  } catch (error) {
    console.error("Error updating line item:", error);
    throw error;
  }
}

/**
 * Xóa sản phẩm khỏi giỏ hàng
 */
export async function removeLineItem(cartId: string, lineItemId: string) {
  try {
    const response = await sdk.store.cart.deleteLineItem(cartId, lineItemId);
    return response.parent;
  } catch (error) {
    console.error("Error removing line item:", error);
    throw error;
  }
}

/**
 * Thêm hoặc đồng bộ địa chỉ giao hàng cho cart.
 */
export async function addShippingAddress(
  cartId: string,
  address: {
    first_name: string;
    last_name: string;
    address_1: string;
    city: string;
    country_code: string;
    address_2?: string;
    province?: string;
    postal_code?: string;
    phone?: string;
  }
) {
  try {
    const response = await updateCartAddresses(cartId, {
      shippingAddress: {
        alias: "",
        address: address.address_1,
        city: address.city,
        name: [address.first_name, address.last_name].filter(Boolean).join(" "),
        phone: address.phone || "",
        address2: address.address_2,
        province: address.province,
        postalCode: address.postal_code,
        countryCode: address.country_code,
      },
    });
    return response;
  } catch (error) {
    console.error("Error adding shipping address:", error);
    throw error;
  }
}

/**
 * Cập nhật thông tin liên hệ của cart (email là bắt buộc cho checkout).
 */
export async function updateCartContact(
  cartId: string,
  payload: {
    email?: string;
  }
) {
  try {
    const response = await sdk.store.cart.update(cartId, {
      ...(payload.email ? { email: payload.email } : {}),
    });
    return response.cart;
  } catch (error) {
    console.error("Error updating cart contact:", error);
    throw error;
  }
}

/**
 * Chọn phương thức vận chuyển
 */
export async function addShippingMethod(
  cartId: string,
  shippingMethodId: string
) {
  try {
    const response = await sdk.store.cart.addShippingMethod(cartId, {
      option_id: shippingMethodId,
    });
    return response.cart;
  } catch (error) {
    console.error("Error adding shipping method:", error);
    throw error;
  }
}

/**
 * Lấy danh sách shipping options khả dụng cho cart hiện tại
 */
export async function listCartShippingOptions(cartId: string) {
  try {
    const response = await sdk.store.fulfillment.listCartOptions({
      cart_id: cartId,
    });
    return response.shipping_options;
  } catch (error) {
    console.error("Error fetching cart shipping options:", error);
    throw error;
  }
}

/**
 * Lấy danh sách payment providers khả dụng dựa theo region của cart.
 */
export async function listCartPaymentProviders(cartId?: string, regionId?: string) {
  try {
    let resolvedRegionId = regionId;
    if (!resolvedRegionId) {
      if (!cartId) {
        return [];
      }
      const cartResponse = await sdk.store.cart.retrieve(cartId);
      resolvedRegionId = cartResponse.cart?.region?.id;
    }
    if (!resolvedRegionId) {
      return [];
    }

    const response = await sdk.store.payment.listPaymentProviders({
      region_id: resolvedRegionId,
    });
    return response.payment_providers || [];
  } catch (error) {
    console.error("Error listing cart payment providers:", error);
    throw error;
  }
}

type MedusaPaymentSession = {
  provider_id?: string;
  client_secret?: string;
  payment_intent_client_secret?: string;
  data?: {
    client_secret?: string;
    payment_intent_client_secret?: string;
    [key: string]: unknown;
  };
  provider_data?: {
    client_secret?: string;
    payment_intent_client_secret?: string;
    [key: string]: unknown;
  };
};

type MedusaPaymentCollection = {
  id?: string;
  payment_sessions?: MedusaPaymentSession[];
  paymentSessions?: MedusaPaymentSession[];
};

type PaymentSessionInitResponse = {
  payment_collection?: MedusaPaymentCollection;
  [key: string]: unknown;
};

function getPaymentSessions(paymentCollection?: MedusaPaymentCollection | null) {
  if (!paymentCollection) {
    return [];
  }

  return paymentCollection.payment_sessions || paymentCollection.paymentSessions || [];
}

export function extractPaymentCollectionClientSecret(
  paymentCollection?: MedusaPaymentCollection | null,
  providerId?: string
) {
  const sessions = getPaymentSessions(paymentCollection);
  const matchedSession =
    (providerId &&
      sessions.find((session) => session.provider_id === providerId)) ||
    sessions[0];

  if (!matchedSession) {
    return undefined;
  }

  return (
    matchedSession.client_secret ||
    matchedSession.payment_intent_client_secret ||
    matchedSession.data?.client_secret ||
    matchedSession.data?.payment_intent_client_secret ||
    matchedSession.provider_data?.client_secret ||
    matchedSession.provider_data?.payment_intent_client_secret
  );
}

export function extractQRCodeUrl(
  paymentSessionResponse: PaymentSessionInitResponse
): string | undefined {
  const paymentCollection = paymentSessionResponse.payment_collection;
  const session = paymentCollection?.payment_sessions?.[0];

  if (!session?.data) {
    return undefined;
  }

  return (session.data as { qr_code_url?: string }).qr_code_url;
}

function toQRNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toQRString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export type QRPaymentDetails = {
  qrCodeUrl?: string;
  transferAmount?: number;
  transferContent?: string;
  currencyCode?: string;
};

export function extractQRPaymentDetails(
  paymentSessionResponse: PaymentSessionInitResponse,
  providerId?: string
): QRPaymentDetails {
  const paymentCollection = paymentSessionResponse.payment_collection;
  const sessions = getPaymentSessions(paymentCollection);
  const matchedSession =
    (providerId &&
      sessions.find((session) => session.provider_id === providerId)) ||
    sessions[0];

  if (!matchedSession) {
    return {};
  }

  const sessionData =
    (matchedSession.data as Record<string, unknown> | undefined) ||
    (matchedSession.provider_data as Record<string, unknown> | undefined) ||
    {};

  const qrCodeUrl =
    toQRString(sessionData.qr_code_url) ||
    toQRString(sessionData.qrCodeUrl);
  const transferAmount =
    toQRNumber(sessionData.transfer_amount) ||
    toQRNumber(sessionData.amount);
  const transferContent =
    toQRString(sessionData.transfer_content) ||
    toQRString(sessionData.transferDescription) ||
    toQRString(sessionData.content) ||
    toQRString(sessionData.note) ||
    toQRString(sessionData.description);
  const currencyCode =
    toQRString(sessionData.currency_code) ||
    toQRString(sessionData.currency);

  return {
    qrCodeUrl,
    transferAmount,
    transferContent,
    currencyCode: currencyCode?.toUpperCase(),
  };
}

/**
 * Khởi tạo payment sessions cho cart.
 */
export async function initializeCartPaymentSessions(
  cartId: string,
  providerId: string
) {
  try {
    const cart = await getCart(cartId);
    const response = await sdk.store.payment.initiatePaymentSession(cart, {
      provider_id: providerId,
    });
    return response as PaymentSessionInitResponse;
  } catch (error) {
    console.error("Error initializing cart payment sessions:", error);
    throw error;
  }
}

/**
 * Tính giá cho shipping option dạng calculated
 */
export async function calculateShippingOption(
  shippingOptionId: string,
  cartId: string
) {
  try {
    const response = await sdk.store.fulfillment.calculate(shippingOptionId, {
      cart_id: cartId,
    });
    return response.shipping_option;
  } catch (error) {
    console.error("Error calculating shipping option:", error);
    throw error;
  }
}

/**
 * Áp dụng mã khuyến mãi cho giỏ hàng
 */
export async function applyPromotionCodes(cartId: string, promoCodes: string[]) {
  try {
    const response = await sdk.client.fetch<{ cart: MedusaCart }>(
      `/store/carts/${cartId}/promotions`,
      {
        method: "POST",
        body: {
          promo_codes: promoCodes,
        },
      }
    );
    return response.cart;
  } catch (error) {
    console.error("Error applying promotions:", error);
    throw error;
  }
}

/**
 * Gỡ mã khuyến mãi khỏi giỏ hàng
 */
export async function removePromotionCodes(cartId: string, promoCodes: string[]) {
  try {
    const response = await sdk.client.fetch<{ cart: MedusaCart }>(
      `/store/carts/${cartId}/promotions`,
      {
        method: "DELETE",
        body: {
          promo_codes: promoCodes,
        },
      }
    );
    return response.cart;
  } catch (error) {
    console.error("Error removing promotions:", error);
    throw error;
  }
}

/**
 * Hoàn tất đơn hàng
 */
export async function completeCart(cartId: string) {
  try {
    // Refetch cart before completion to ensure latest state
    const currentCart = await getCart(cartId);
    
    // Validate cart state before attempting completion
    if (!currentCart.email) {
      throw new Error("Cart email not set. Cannot complete checkout.");
    }
    if (!currentCart.shipping_address) {
      throw new Error("Cart shipping address not set. Cannot complete checkout.");
    }
    if (!currentCart.shipping_methods || currentCart.shipping_methods.length === 0) {
      throw new Error("Cart shipping method not selected. Cannot complete checkout.");
    }
    
    console.log("[completeCart] Cart validation passed. Attempting completion...", {
      cartId,
      email: currentCart.email,
      shippingMethods: currentCart.shipping_methods?.map(m => ({ id: m.id, name: m.name })),
    });

    const response = await sdk.store.cart.complete(cartId);

    if (response.type === "cart") {
      const errorMessage =
        typeof response.error === "object" && response.error
          ? JSON.stringify(response.error)
          : typeof response.error === "string"
            ? response.error
            : "cart_not_completed";
      console.error("[completeCart] Cart completion failed:", errorMessage);
      throw new Error(
        `Medusa checkout chưa hoàn tất cart. error=${errorMessage}`
      );
    }

    return response.order;
  } catch (error) {
    console.error("Error completing cart:", error);
    throw error;
  }
}

/**
 * Lấy danh sách đơn hàng của khách hàng
 */
export async function getOrders(params?: {
  limit?: number;
  offset?: number;
  fields?: string;
}) {
  try {
    // Debug: show token presence when getOrders is called
    try {
      // eslint-disable-next-line no-console
      console.log("[getOrders] medusa token present:", !!localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN));
    } catch (e) {
      // ignore
    }

    const fieldsToRequest = params?.fields || ORDER_QUERY_FIELDS;
    const response = await sdk.store.order.list({
      ...params,
      fields: fieldsToRequest,
    });

    try {
      // eslint-disable-next-line no-console
      console.log(
        "[getOrders] fetched orders count:",
        Array.isArray(response?.orders) ? response.orders.length : 0
      );
    } catch (e) {
      // ignore
    }

    return response.orders;
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
}

/**
 * Lấy chi tiết đơn hàng
 */
export async function getOrder(orderId: string) {
  try {
    const response = await sdk.store.order.retrieve(orderId, {
      fields: ORDER_QUERY_FIELDS,
    });
    return response.order;
  } catch (error) {
    console.error("Error fetching order:", error);
    throw error;
  }
}

/**
 * Đăng nhập khách hàng
 */
export async function loginCustomer(email: string, password: string) {
  try {
    const response = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    });
    return response;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
}

/**
 * Đăng ký khách hàng mới
 */
export async function registerCustomer(email: string, password: string, firstName?: string, lastName?: string) {
  try {
    const response = await sdk.auth.register("customer", "emailpass", {
      email,
      password,
      ...(firstName && { first_name: firstName }),
      ...(lastName && { last_name: lastName }),
    });
    return response;
  } catch (error) {
    console.error("Error registering customer:", error);
    throw error;
  }
}

/**
 * Lấy thông tin khách hàng hiện tại
 */
export async function getCurrentCustomer() {
  try {
    const response = await sdk.store.customer.retrieve();
    return response.customer;
  } catch (error) {
    console.error("Error fetching customer:", error);
    throw error;
  }
}

/**
 * Lấy địa chỉ customer hiện tại từ Medusa.
 */
export async function getCurrentCustomerAddress() {
  try {
    const response = await sdk.store.customer.listAddress({
      limit: 1,
      fields: "id,first_name,last_name,address_1,address_2,city,province,postal_code,country_code,phone,metadata",
    });
    return transformMedusaCustomerAddressToShippingAddress(response.addresses?.[0]);
  } catch (error) {
    if (isAuthError(error)) {
      await clearMedusaAuthFromStorage();
      return undefined;
    }
    console.error("Error fetching customer address:", error);
    throw error;
  }
}

export async function upsertCurrentCustomerAddress(address: ShippingAddress) {
  try {
    const response = await sdk.store.customer.listAddress({
      limit: 1,
      fields: "id",
    });
    const existingAddress = transformMedusaCustomerAddressRecord(response.addresses?.[0]);
    const { first_name, last_name } = splitFullName(address.name || "");
    const body: Record<string, unknown> = {
      address_1: address.address,
      address_2: address.address2,
      city: address.city,
      province: address.province,
      postal_code: address.postalCode,
      country_code: address.countryCode || "vn",
      phone: address.phone || undefined,
      metadata: {
        alias: address.alias || undefined,
      },
    };

    if (first_name) {
      body.first_name = first_name;
    }
    if (last_name) {
      body.last_name = last_name;
    }

    if (existingAddress?.id) {
      return await sdk.store.customer.updateAddress(existingAddress.id, body);
    }

    return await sdk.store.customer.createAddress(body);
  } catch (error) {
    console.error("Error upserting customer address:", error);
    throw error;
  }
}

/**
 * Cập nhật shipping/billing address của cart.
 */
export async function updateCartAddresses(
  cartId: string,
  payload: {
    shippingAddress: ShippingAddress;
    billingAddress?: ShippingAddress;
    email?: string;
  }
) {
  try {
    const response = await sdk.store.cart.update(cartId, {
      ...(payload.email ? { email: payload.email } : {}),
      shipping_address: toShippingAddressPayload(payload.shippingAddress),
      billing_address: toShippingAddressPayload(payload.billingAddress || payload.shippingAddress),
    });
    return response.cart;
  } catch (error) {
    console.error("Error updating cart addresses:", error);
    throw error;
  }
}

/**
 * Cập nhật thông tin customer hiện tại trên Medusa.
 */
export async function updateCurrentCustomer(payload: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const response = await sdk.store.customer.update({
      first_name: payload.first_name,
      last_name: payload.last_name,
      phone: payload.phone,
      metadata: payload.metadata,
    });
    return response.customer;
  } catch (error) {
    console.error("Error updating customer:", error);
    throw error;
  }
}

/**
 * Chuyển Medusa customer thành UserInfo của app.
 */
export function transformMedusaCustomerToUserInfo(customer: unknown): UserInfo | null {
  if (!customer || typeof customer !== "object") {
    return null;
  }

  const record = customer as {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    image?: string;
    metadata?: Record<string, unknown>;
  };

  const firstName = typeof record.first_name === "string" ? record.first_name.trim() : "";
  const lastName = typeof record.last_name === "string" ? record.last_name.trim() : "";
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const metadata = record.metadata || {};
  const address =
    (typeof metadata.address === "string" && metadata.address) ||
    (typeof metadata.address_1 === "string" && metadata.address_1) ||
    (typeof metadata.city === "string" && metadata.city) ||
    "";

  return {
    id: record.id || "",
    name: name || (typeof metadata.name === "string" ? metadata.name : ""),
    avatar:
      record.avatar ||
      record.image ||
      (typeof metadata.avatar === "string" ? metadata.avatar : "") ||
      DEFAULT_AVATAR_URL,
    phone:
      record.phone ||
      (typeof metadata.phone === "string" ? metadata.phone : "") ||
      "",
    email: record.email || "",
    address,
  };
}

/**
 * Tìm kiếm sản phẩm
 */
export async function searchProducts(query: string, params?: {
  limit?: number;
  offset?: number;
  region_id?: string;
  country_code?: string;
  province?: string;
  cart_id?: string;
  fields?: string;
}) {
  try {
    const regionId = params?.region_id || (await getDefaultRegionId());
    const response = await sdk.store.product.list({
      q: query,
      ...params,
      fields: ensureCalculatedPriceField(params?.fields),
      ...(regionId ? { region_id: regionId } : {}),
    });
    return response.products;
  } catch (error) {
    console.error("Error searching products:", error);
    throw error;
  }
}

/**
 * Lấy danh sách regions (khu vực hỗ trợ)
 */
export async function getRegions() {
  try {
    // Cache regions to avoid duplicate network requests during app bootstrap
    // or concurrent atom reads. This is a lightweight in-memory cache.
    if ((getRegions as any)._cachedRegions) {
      return (getRegions as any)._cachedRegions as unknown as ReturnType<typeof sdk.store.region.list>;
    }
    const response = await sdk.store.region.list();
    (getRegions as any)._cachedRegions = response.regions;
    return response.regions;
  } catch (error) {
    console.error("Error fetching regions:", error);
    throw error;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseStorefrontProfile(source: unknown): StorefrontProfile | null {
  if (!isObject(source)) {
    return null;
  }

  const metadata = isObject(source.metadata) ? source.metadata : {};
  const shopName =
    toNonEmptyString(source.shop_name) ||
    toNonEmptyString(source.name) ||
    toNonEmptyString(metadata.shop_name) ||
    toNonEmptyString(metadata.shopName);
  const shopAddress =
    toNonEmptyString(source.shop_address) ||
    toNonEmptyString(source.address) ||
    toNonEmptyString(metadata.shop_address) ||
    toNonEmptyString(metadata.shopAddress);
  const logoUrl =
    toNonEmptyString(source.logo_url) ||
    toNonEmptyString(source.logoUrl) ||
    toNonEmptyString(metadata.logo_url) ||
    toNonEmptyString(metadata.logoUrl);

  if (!shopName || !shopAddress || !logoUrl) {
    return null;
  }

  return { shopName, shopAddress, logoUrl };
}

type BranchPayload = {
  id?: string | number;
  name?: string;
  address?: string;
  image?: string;
  latitude?: number;
  longitude?: number;
  location?: {
    lat?: number;
    lng?: number;
  };
};

function mapBranchToStation(branch: BranchPayload, index: number): Station | null {
  const name = toNonEmptyString(branch.name);
  const address = toNonEmptyString(branch.address);
  if (!name || !address) {
    return null;
  }

  const lat = branch.location?.lat ?? branch.latitude;
  const lng = branch.location?.lng ?? branch.longitude;

  return {
    id:
      typeof branch.id === "number"
        ? branch.id
        : 2_000_000 + index,
    name,
    image: toNonEmptyString(branch.image) || "",
    address,
    location: {
      lat: typeof lat === "number" ? lat : 10.773756,
      lng: typeof lng === "number" ? lng : 106.689247,
    },
    source: "medusa",
  };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseLoyaltyProfile(source: unknown): LoyaltyProfile | null {
  if (!isObject(source)) {
    return null;
  }

  const points = toNumber(source.points);
  const expiryDate =
    toNonEmptyString(source.expiry_date) ||
    toNonEmptyString(source.expiryDate) ||
    toNonEmptyString(source.expires_at) ||
    toNonEmptyString(source.expiresAt);
  const barcodeValue =
    toNonEmptyString(source.barcode_value) ||
    toNonEmptyString(source.barcodeValue) ||
    toNonEmptyString(source.member_code) ||
    toNonEmptyString(source.memberCode) ||
    toNonEmptyString(source.code);

  if (points === undefined || !expiryDate || !barcodeValue) {
    return null;
  }

  return {
    points,
    expiryDate,
    barcodeValue,
  };
}

/**
 * Lấy thông tin branding của storefront từ Medusa.
 * Chỉ gọi custom route `/store/storefront-profile` để tránh fallback sang route không tồn tại.
 */
export async function getStorefrontProfile(): Promise<StorefrontProfile | null> {
  try {
    const customResponse = await sdk.client.fetch<{
      storefront?: unknown;
      profile?: unknown;
      store?: unknown;
    }>("/store/storefront-profile");
    const profile =
      parseStorefrontProfile(customResponse.storefront) ||
      parseStorefrontProfile(customResponse.profile) ||
      parseStorefrontProfile(customResponse.store);
    if (profile) {
      return profile;
    }
  } catch (error) {
    console.warn("Custom storefront profile endpoint unavailable:", error);
  }
  return null;
}

/**
 * Lấy danh sách chi nhánh/kho từ custom Medusa route.
 */
export async function getStoreBranches(): Promise<Station[]> {
  try {
    const response = await sdk.client.fetch<{
      branches?: BranchPayload[];
      stations?: BranchPayload[];
      locations?: BranchPayload[];
    }>("/store/branches");
    const rows = response.branches || response.stations || response.locations || [];
    return rows
      .map(mapBranchToStation)
      .filter((station): station is Station => station !== null);
  } catch (error) {
    console.warn("Store branches endpoint unavailable:", error);
    return [];
  }
}

/**
 * Lấy điểm tích lũy thành viên cho màn hình Profile.
 */
export async function getLoyaltyProfile(): Promise<LoyaltyProfile | null> {
  try {
    const response = await sdk.client.fetch<{
      loyalty?: unknown;
      points?: unknown;
      member?: unknown;
      profile?: unknown;
      data?: unknown;
    }>("/store/loyalty-profile");
    const profile =
      parseLoyaltyProfile(response.loyalty) ||
      parseLoyaltyProfile(response.points) ||
      parseLoyaltyProfile(response.member) ||
      parseLoyaltyProfile(response.profile) ||
      parseLoyaltyProfile(response.data) ||
      parseLoyaltyProfile(response);
    return profile;
  } catch (error) {
    console.warn("Loyalty profile endpoint unavailable:", error);
    return null;
  }
}

/**
 * Xác thực khách hàng bằng access token từ Zalo Mini App.
 * Backend chịu trách nhiệm verify token với Zalo Open API và tạo/tìm customer tương ứng.
 */
export async function authenticateWithZaloAccessToken(accessToken: string) {
  try {
    const response = await sdk.client.fetch<{
      token?: string;
      jwt?: string;
      accessToken?: string;
      user?: unknown;
      customer?: unknown;
      profile?: unknown;
      id?: string;
      name?: string;
      avatar?: string;
    }>("/auth/zalo", {
      method: "POST",
      body: {
        accessToken,
      },
    });

    const authToken = response.jwt || response.token || response.accessToken;
    if (!authToken) {
      throw new Error(
        "Auth response missing token/jwt/accessToken. Cannot call user-scoped Store APIs."
      );
    }

    await sdk.client.setToken(authToken);
    // Debug: log token presence for troubleshooting auth issues
    try {
      console.debug("[Auth Debug] setToken called with token (length):", typeof authToken === 'string' ? authToken.length : authToken);
      // Try to introspect SDK client token if available
      const sdkToken = (sdk.client as any).getToken ? (sdk.client as any).getToken() : (sdk.client as any).token;
      console.debug("[Auth Debug] sdk.client token available:", sdkToken ? (typeof sdkToken === 'string' ? sdkToken.slice(0, 8) + '...' : sdkToken) : sdkToken);
    } catch (e) {
      console.debug("[Auth Debug] could not introspect sdk.client token:", e);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN, authToken);
    }

    return response;
  } catch (error) {
    console.error("Error authenticating with Zalo access token:", error);
    throw error;
  }
}

/**
 * Khôi phục token phiên customer đã lưu để SDK gọi được các endpoint cần auth.
 */
export async function hydrateMedusaAuthFromStorage() {
  if (typeof window === "undefined") {
    return false;
  }

  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN);
  if (!token) {
    return false;
  }

  await sdk.client.setToken(token);
  try {
    console.debug("[Auth Debug] hydrateMedusaAuthFromStorage applied token (length):", typeof token === 'string' ? token.length : token);
    const sdkToken = (sdk.client as any).getToken ? (sdk.client as any).getToken() : (sdk.client as any).token;
    console.debug("[Auth Debug] sdk.client token after hydrate:", sdkToken ? (typeof sdkToken === 'string' ? sdkToken.slice(0,8)+"..." : sdkToken) : sdkToken);

    // Decode JWT payload (best-effort) to inspect actor_id and other claims
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
        const json = atob(padded);
        const payload = JSON.parse(json);
        console.debug('[Auth Debug] Decoded token payload:', payload);

        // If actor_id is missing or empty, this token is likely a registration token
        // or otherwise not suitable for calling protected store endpoints.
        if (!payload || !payload.actor_id) {
          console.warn('[Auth Debug] Token missing actor_id — clearing token to avoid 401s');
          // Clear stored token and SDK token to prevent further protected calls
          try {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN);
          } catch (e) {
            console.warn('[Auth Debug] Could not remove token from storage:', e);
          }
          try {
            sdk.client.clearToken?.();
          } catch (e) {
            // some SDK builds may not expose clearToken
            try {
              (sdk.client as any).setToken?.(null);
            } catch (e2) {}
          }
          return false;
        }
      }
    } catch (decodeErr) {
      console.debug('[Auth Debug] Failed to decode token payload:', decodeErr);
    }
  } catch (e) {
    console.debug("[Auth Debug] could not introspect sdk.client token after hydrate:", e);
  }
  return true;
}

/**
 * Xóa token customer đã lưu khi phiên auth không còn hợp lệ.
 */
export async function clearMedusaAuthFromStorage() {
  if (typeof window === "undefined") {
    return false;
  }

  localStorage.removeItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN);
  sdk.client.clearToken();
  return true;
}

// ==================== GUEST AUTO-AUTH FLOW ====================

const GUEST_FIXED_PASSWORD = "password";
const GUEST_EMAIL_DOMAIN = "@q-com.com";
const GUEST_EMAIL_PREFIX = "guest_";

/**
 * Generate a UUIDv7-like string for guest email uniqueness.
 * Simple implementation: 8-char random hex string based on timestamp and randomness
 */
function generateGuestUuid(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 0xffffff);
  const combined = (timestamp << 24) | random;
  return combined.toString(16).padStart(12, '0');
}

/**
 * Generate a random guest email with UUIDv7 format
 */
export function generateGuestEmail(): string {
  const uuid = generateGuestUuid();
  return `${GUEST_EMAIL_PREFIX}${uuid}${GUEST_EMAIL_DOMAIN}`;
}

/**
 * Perform guest auto-authentication:
 * 1. Generate random guest email
 * 2. Register with fixed password
 * 3. Login and save JWT token
 * 4. Return guest email for later use
 */
export async function performGuestAutoAuth(): Promise<{
  email: string;
  success: boolean;
  error?: unknown;
}> {
  const guestEmail = generateGuestEmail();
  console.log("[Guest Auth] Starting auto-authentication with email:", guestEmail);

  try {
    // Step 1: Try to register as a new guest customer
    console.log("[Guest Auth] Step 1: Attempting to register guest customer...");
    try {
      const registerResponse = await registerCustomer(guestEmail, GUEST_FIXED_PASSWORD);
      console.log("[Guest Auth] Step 1 SUCCESS: Customer registered");

      // If registration returned a registration token, use it to create the
      // actual customer resource in the store (required by Medusa's auth flow).
      // Some Medusa setups return a registration token from the register route
      // which must be exchanged by calling POST /store/customers with that
      // token in the Authorization header to create the customer and link
      // the auth identity (actor_id). If we don't do this the later login
      // may yield a token that lacks `actor_id` and protected store routes
      // (e.g. /store/customers/me) will return 401.
      try {
        let registrationToken: string | undefined;
        if (registerResponse) {
          if (typeof registerResponse === "string") {
            registrationToken = registerResponse;
          } else if ((registerResponse as any).token) {
            registrationToken = (registerResponse as any).token;
          } else if ((registerResponse as any).data && (registerResponse as any).data.token) {
            registrationToken = (registerResponse as any).data.token;
          }
        }

        if (registrationToken) {
          try {
            const createCustomerUrl = `${MEDUSA_BACKEND_URL.replace(/\/$/, "")}/store/customers`;
            const resp = await (typeof window !== 'undefined'
              ? window.fetch(createCustomerUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${registrationToken}`,
                    'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY || '',
                  },
                  body: JSON.stringify({ email: guestEmail }),
                })
              : Promise.reject(new Error('no window')));

            if (!resp.ok) {
              const txt = await resp.text().catch(() => "");
              console.warn('[Guest Auth] create customer with registration token returned', resp.status, txt);
            } else {
              console.log('[Guest Auth] create customer succeeded for', guestEmail);
            }
          } catch (createErr) {
            console.warn('[Guest Auth] Failed to create customer after register:', createErr);
          }
        }
      } catch (e) {
        console.warn('[Guest Auth] Registration token handling failed:', e);
      }
    } catch (registerError: unknown) {
      // If email already exists (very unlikely but possible in edge cases),
      // we'll proceed to login. In normal cases, registration should succeed.
      const errorStatus = getErrorStatusCode(registerError);
      console.warn("[Guest Auth] Step 1 CONFLICT (email might exist): status=", errorStatus, registerError);
      if (errorStatus === 400 || errorStatus === 409) {
        console.log("[Guest Auth] Proceeding to login with existing email...");
      } else {
        throw registerError;
      }
    }

    // Step 2: Login as guest - this returns the JWT token directly
    // Medusa SDK's auth.login() returns the token as a string and also sets it internally
    console.log("[Guest Auth] Step 2: Attempting to login guest customer...");
    const authToken = await loginCustomer(guestEmail, GUEST_FIXED_PASSWORD);

    if (!authToken || typeof authToken !== 'string') {
      console.error("[Guest Auth] Step 2 FAILED: No valid JWT token returned from login. Got:", authToken);
      throw new Error("Guest login did not return a valid JWT token");
    }

    console.log("[Guest Auth] Step 2 SUCCESS: JWT token received from login, length:", authToken.length);

    // Decode and log token payload to surface actor_id (helps diagnose 401s)
    try {
      const parts = authToken.split('.');
      if (parts.length >= 2) {
        const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
        const json = atob(padded);
        const payload = JSON.parse(json);
        console.debug('[Guest Auth] Decoded login token payload:', payload);
        console.debug('[Guest Auth] login token actor_id:', payload?.actor_id);
        if (!payload?.actor_id) {
          console.warn('[Guest Auth] Login token missing actor_id — this token will not access protected store endpoints.');
        }
      }
    } catch (e) {
      console.debug('[Guest Auth] Failed to decode login token payload:', e);
    }

    // Step 3: Save token to localStorage for session persistence and set SDK token
    console.log("[Guest Auth] Step 3: Saving credentials to localStorage and applying token to SDK...");
    if (typeof window !== "undefined") {
      try {
        // Ensure SDK will send Authorization header for subsequent requests
        await sdk.client.setToken(authToken);
      } catch (setTokenErr) {
        console.warn("[Guest Auth] Warning: failed to set token on SDK client:", setTokenErr);
      }

      try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN, authToken);
      } catch (e) {
        console.warn("[Guest Auth] Warning: failed to persist token to localStorage:", e);
      }

      try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.GUEST_EMAIL || "guestEmail", guestEmail);
      } catch (e) {
        // fallback to literal key if config missing
        try {
          localStorage.setItem("guestEmail", guestEmail);
        } catch (e2) {
          console.warn("[Guest Auth] Warning: failed to persist guest email:", e2);
        }
      }

      console.log("[Guest Auth] Step 3 SUCCESS: Credentials saved and SDK token applied");
    }

    // Step 4: Verify authentication is working
    console.log("[Guest Auth] Step 4: Verifying authentication...");
    try {
      const customer = await getCurrentCustomer();
      if (customer && customer.email) {
        console.log("[Guest Auth] Step 4 SUCCESS: Verified - current customer email:", customer.email);

        // Step 5: Upsert default shipping/billing address for this customer
        try {
          const defaultAddress = {
            alias: "",
            address: "Uit",
            address2: undefined,
            city: "Hồ Chí Minh",
            province: undefined,
            postalCode: "73000",
            countryCode: "vn",
            name: `Thái`,
            phone: "0566464459",
          } as import("@/types").ShippingAddress;

          console.log("[Guest Auth] Step 5: Upserting default customer address...");
          await upsertCurrentCustomerAddress(defaultAddress);
          console.log("[Guest Auth] Step 5 SUCCESS: Default address upserted for customer", customer.email);
        } catch (addrErr) {
          console.warn("[Guest Auth] Step 5 WARNING: Failed to upsert default address:", addrErr);
        }
      }
    } catch (verifyError) {
      console.warn("[Guest Auth] Step 4 WARNING: Could not verify customer:", verifyError);
      // Don't fail - token might still be valid
      // Diagnostic fallback: try explicit fetch with Authorization header and publishable key
      try {
        console.log("[Guest Auth] Diagnostic: explicit fetch /store/customers/me with Authorization header...");
        const explicitResp = await (sdk.client as any).fetch?.("/store/customers/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY || "",
          },
        });
        console.log("[Guest Auth] Diagnostic explicit /store/customers/me response:", explicitResp);
      } catch (explicitErr) {
        console.warn("[Guest Auth] Diagnostic explicit /store/customers/me failed:", explicitErr);
      }

      try {
        console.log("[Guest Auth] Diagnostic: explicit fetch /store/customers/me/addresses with Authorization header...");
        const explicitAddr = await (sdk.client as any).fetch?.("/store/customers/me/addresses?limit=1&fields=id,first_name,last_name,address_1,address_2,city,province,postal_code,country_code,phone,metadata", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY || "",
          },
        });
        console.log("[Guest Auth] Diagnostic explicit addresses response:", explicitAddr);
      } catch (explicitAddrErr) {
        console.warn("[Guest Auth] Diagnostic explicit addresses fetch failed:", explicitAddrErr);
      }
      // Final diagnostic: raw window.fetch to backend URL to capture full HTTP response
      try {
        const meUrl = `${MEDUSA_BACKEND_URL.replace(/\/$/, "")}/store/customers/me`;
        console.log("[Guest Auth] Raw fetch diagnostic to:", meUrl);
        const resp = await (typeof window !== 'undefined' ? window.fetch(meUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY || '',
          },
          // include credentials in case server expects cookie-based session
          credentials: 'include',
        }) : Promise.reject(new Error('no window')));

        const text = await resp.text();
        console.log('[Guest Auth] Raw fetch response status:', resp.status, 'headers:', Array.from(resp.headers.entries()));
        console.log('[Guest Auth] Raw fetch response body:', text);
      } catch (rawErr) {
        console.warn('[Guest Auth] Raw fetch diagnostic failed:', rawErr);
      }
    }

    console.log("[Guest Auth] ✅ COMPLETE: Guest auto-authentication successful for", guestEmail);
    return { email: guestEmail, success: true };
  } catch (error) {
    console.error("[Guest Auth] ❌ FAILED: Auto-authentication failed:", error);
    return { 
      email: guestEmail, 
      success: false, 
      error 
    };
  }
}

/**
 * Get the stored guest email (for reference/debugging).
 * This is the email that was auto-generated and used for guest authentication.
 */
export function getStoredGuestEmail(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("guestEmail") || null;
}

/**
 * Check if user is authenticated (has valid JWT token).
 * If not, and no token in storage, perform guest auto-auth.
 * This is called during bootstrap.
 */
export async function ensureGuestAuthOnBootstrap(): Promise<void> {
  console.log("[Guest Auth Bootstrap] Starting...");
  try {
    if (typeof window !== "undefined") {
      // On the very first app bootstrap run we clear any previously stored
      // Medusa auth token to avoid stale provider/legacy tokens (e.g. Zalo)
      // interfering with our guest auto-register/login flow. This is done
      // only once and recorded by a bootstrapped flag so returning users
      // aren't logged out on subsequent visits.
      const bootstrappedKey = CONFIG.STORAGE_KEYS.BOOTSTRAPPED;
      const isBootstrapped = Boolean(localStorage.getItem(bootstrappedKey));
      if (!isBootstrapped) {
        console.log(
          "[Guest Auth Bootstrap] First run detected — clearing stored Medusa auth token to avoid stale provider flows."
        );
        await clearMedusaAuthFromStorage();
        try {
          localStorage.setItem(bootstrappedKey, "1");
        } catch (e) {
          console.warn("[Guest Auth Bootstrap] Could not set bootstrapped flag in localStorage:", e);
        }
      }
    }

    // Check if token is already set in SDK/storage after first-run clearing
    const storedToken = typeof window !== "undefined"
      ? localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN)
      : null;

    if (storedToken) {
      // Token already exists, no need for guest auth
      console.log("[Guest Auth Bootstrap] ✓ Token already exists in localStorage, skipping auto-auth");
      return;
    }

    console.log("[Guest Auth Bootstrap] No token found, performing guest auto-auth...");
    // No token in storage, perform guest auto-auth
    const result = await performGuestAutoAuth();
    if (!result.success) {
      // Auto-auth failed, but we don't throw error - let app continue in guest mode
      console.warn("[Guest Auth Bootstrap] ⚠ Could not establish guest authentication, app will work in limited guest mode. Error:", result.error);
    }
  } catch (error) {
    // Catch-all: don't let auth failures block app bootstrap
    console.error("[Guest Auth Bootstrap] ❌ Unexpected error during guest auth bootstrap:", error);
  }
}

export default sdk;
